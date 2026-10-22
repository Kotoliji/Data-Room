import re
import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, Response, request, jsonify, current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app import db, limiter
from app.models import User, File, Folder, ShareLink, ShareAccess, SharePageView
from app.services.file_service import is_inline_viewable, send_stored_file, served_mime
from app.utils import require_auth
from app.constants import SHARE_ACCESS_TOKEN_MAX_AGE

shares_bp = Blueprint("shares", __name__)
public_bp = Blueprint("public_shares", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_HEARTBEAT_SECONDS = 120  # the viewer reports every ~15s; cap what one report can add
ANALYTICS_DAYS = 14


# --------------- Scope helpers ---------------

def _folder_in_scope(link: ShareLink, folder: Folder | None) -> bool:
    """A folder is visible if it is active and sits inside the link's root (or the root itself)."""
    node = folder
    while node:
        if node.user_id != link.user_id or node.status != "active":
            return False
        if node.id == link.folder_id:
            return True
        node = db.session.get(Folder, node.parent_id) if node.parent_id else None
    return folder is not None and link.folder_id is None


def _file_in_scope(link: ShareLink, record: File) -> bool:
    if record.user_id != link.user_id:
        return False
    if record.folder_id == "all":
        return link.folder_id is None
    prefix, _, raw_id = record.folder_id.partition(":")
    if prefix != "folder" or not raw_id.isdigit():
        return False  # Trash and anything unknown is never shared
    return _folder_in_scope(link, db.session.get(Folder, int(raw_id)))


def _public_file(record: File) -> dict:
    return {
        "id": record.id,
        "name": record.original_name,
        "size": record.size,
        "mime_type": record.mime_type,
        "created_at": record.created_at.isoformat(),
        "viewable": is_inline_viewable(record),
    }


def _log(link: ShareLink, email: str, action: str, record: File | None = None) -> None:
    db.session.add(ShareAccess(
        link_id=link.id, viewer_email=email, action=action,
        file_id=record.id if record else None,
        file_name=record.original_name if record else None,
        ip=request.remote_addr or "unknown",
    ))
    db.session.commit()


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"])


def _active_link(token: str) -> tuple[ShareLink | None, tuple[Response, int] | None]:
    link = ShareLink.query.filter_by(token=token).first()
    if not link or link.revoked:
        return None, (jsonify({"data": None, "error": "This link does not exist or was revoked"}), 404)
    if link.is_expired():
        return None, (jsonify({"data": None, "error": "This link has expired"}), 410)
    return link, None


def _authorized_viewer(token: str) -> tuple[ShareLink | None, str | None, tuple[Response, int] | None]:
    """Validate the share link and the viewer's access token issued by /unlock."""
    link, error = _active_link(token)
    if error:
        return None, None, error
    access = request.headers.get("X-Share-Access") or request.args.get("access", "")
    try:
        data = _serializer().loads(access, salt="share-access", max_age=SHARE_ACCESS_TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None, None, (jsonify({"data": None, "error": "Access expired — please open the link again"}), 401)
    if data.get("lid") != link.id:
        return None, None, (jsonify({"data": None, "error": "Access token does not match this link"}), 401)
    return link, data["email"], None


# --------------- Owner endpoints ---------------

@shares_bp.route("", methods=["GET"])
@require_auth
def list_shares(user: User) -> tuple[Response, int]:
    links = ShareLink.query.filter_by(user_id=user.id).order_by(ShareLink.created_at.desc()).all()
    return jsonify({"data": {"shares": [link.to_dict() for link in links]}, "error": None}), 200


@shares_bp.route("", methods=["POST"])
@require_auth
def create_share(user: User) -> tuple[Response, int]:
    data = request.get_json(silent=True) or {}
    folder_id = data.get("folder_id")
    folder = None
    if folder_id is not None:
        folder = Folder.query.filter_by(id=folder_id, user_id=user.id, status="active").first()
        if not folder:
            return jsonify({"data": None, "error": "Folder not found"}), 404

    name = str(data.get("name") or "").strip() or (folder.name if folder else "Data Room")
    password = data.get("password") or None
    if password is not None and (not isinstance(password, str) or len(password) < 4):
        return jsonify({"data": None, "error": "Password must be at least 4 characters"}), 400

    expires_in_days = data.get("expires_in_days")
    expires_at = None
    if expires_in_days is not None:
        if not isinstance(expires_in_days, int) or not 1 <= expires_in_days <= 365:
            return jsonify({"data": None, "error": "Expiry must be between 1 and 365 days"}), 400
        expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=expires_in_days)

    link = ShareLink(
        token=secrets.token_urlsafe(24),
        user_id=user.id,
        folder_id=folder.id if folder else None,
        name=name[:120],
        expires_at=expires_at,
        allow_download=bool(data.get("allow_download", False)),
    )
    link.set_password(password)
    db.session.add(link)
    db.session.commit()

    current_app.logger.info("Share link %d created for user %s (folder %s)", link.id, user.id, link.folder_id)
    return jsonify({"data": link.to_dict(), "error": None}), 201


@shares_bp.route("/<int:link_id>", methods=["DELETE"])
@require_auth
def revoke_share(user: User, link_id: int) -> tuple[Response, int]:
    link = ShareLink.query.filter_by(id=link_id, user_id=user.id).first()
    if not link:
        return jsonify({"data": None, "error": "Link not found"}), 404
    link.revoked = True  # keep the row so the access trail survives
    db.session.commit()
    return jsonify({"data": link.to_dict(), "error": None}), 200


@shares_bp.route("/<int:link_id>/accesses", methods=["GET"])
@require_auth
def share_accesses(user: User, link_id: int) -> tuple[Response, int]:
    link = ShareLink.query.filter_by(id=link_id, user_id=user.id).first()
    if not link:
        return jsonify({"data": None, "error": "Link not found"}), 404
    entries = link.accesses.limit(200).all()
    return jsonify({"data": {"accesses": [e.to_dict() for e in entries]}, "error": None}), 200


# --------------- Public (viewer) endpoints ---------------

@public_bp.route("/<token>", methods=["GET"])
def share_info(token: str) -> tuple[Response, int]:
    link, error = _active_link(token)
    if error:
        return error
    owner = db.session.get(User, link.user_id)
    return jsonify({"data": {
        "name": link.name,
        "owner_name": owner.name if owner else "",
        "requires_password": link.password_hash is not None,
        "allow_download": link.allow_download,
        "expires_at": link.expires_at.isoformat() if link.expires_at else None,
    }, "error": None}), 200


@public_bp.route("/<token>/unlock", methods=["POST"])
@limiter.limit("10 per minute")
def unlock_share(token: str) -> tuple[Response, int]:
    link, error = _active_link(token)
    if error:
        return error
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    if not EMAIL_RE.match(email):
        return jsonify({"data": None, "error": "Enter a valid email address"}), 400
    if not link.check_password(str(data.get("password", ""))):
        return jsonify({"data": None, "error": "Incorrect password"}), 403

    _log(link, email, "opened")
    access = _serializer().dumps({"lid": link.id, "email": email}, salt="share-access")
    return jsonify({"data": {"access_token": access}, "error": None}), 200


@public_bp.route("/<token>/contents", methods=["GET"])
def share_contents(token: str) -> tuple[Response, int]:
    link, _, error = _authorized_viewer(token)
    if error:
        return error

    raw_folder = request.args.get("folder_id")
    if raw_folder:
        if not raw_folder.isdigit():
            return jsonify({"data": None, "error": "Invalid folder"}), 400
        current = db.session.get(Folder, int(raw_folder))
        if not _folder_in_scope(link, current):
            return jsonify({"data": None, "error": "Folder not found"}), 404
    else:
        current = link.folder

    # Breadcrumb from the shared root (exclusive) down to the current folder
    path = []
    node = current
    while node and node.id != link.folder_id:
        path.append({"id": node.id, "name": node.name})
        node = db.session.get(Folder, node.parent_id) if node.parent_id else None
    path.reverse()

    parent_id = current.id if current else None
    file_key = f"folder:{current.id}" if current else "all"
    folders = (Folder.query.filter_by(user_id=link.user_id, parent_id=parent_id, status="active")
               .order_by(Folder.name).all())
    files = (File.query.filter_by(user_id=link.user_id, folder_id=file_key)
             .order_by(File.original_name).all())

    return jsonify({"data": {
        "path": path,
        "folders": [{"id": f.id, "name": f.name, "color": f.color} for f in folders],
        "files": [_public_file(f) for f in files],
    }, "error": None}), 200


@public_bp.route("/<token>/files/<int:file_id>", methods=["GET"])
def share_file(token: str, file_id: int) -> Response | tuple[Response, int]:
    link, email, error = _authorized_viewer(token)
    if error:
        return error

    record = db.session.get(File, file_id)
    if not record or not _file_in_scope(link, record):
        return jsonify({"data": None, "error": "File not found"}), 404

    download = request.args.get("download") == "1"
    if (download or not is_inline_viewable(record)) and not link.allow_download:
        return jsonify({"data": None, "error": "The owner disabled downloads for this link"}), 403

    stamp = f"{email} · {datetime.now(timezone.utc):%d %b %Y}"
    response = send_stored_file(record, download=download, watermark=stamp)
    if response is None:
        return jsonify({"data": None, "error": "File not found on disk"}), 404
    _log(link, email, "downloaded" if download or not is_inline_viewable(record) else "viewed", record)
    return response


@public_bp.route("/<token>/files/<int:file_id>/pages", methods=["POST"])
@limiter.limit("60 per minute")
def track_pages(token: str, file_id: int) -> tuple[Response, int]:
    """Heartbeat from the in-app PDF viewer: {"pages": {"<page>": <seconds>}}."""
    link, email, error = _authorized_viewer(token)
    if error:
        return error
    record = db.session.get(File, file_id)
    if not record or not _file_in_scope(link, record) or served_mime(record) != "application/pdf":
        return jsonify({"data": None, "error": "File not found"}), 404

    # navigator.sendBeacon posts text/plain to stay CORS-simple, so parse regardless of type
    pages = (request.get_json(force=True, silent=True) or {}).get("pages")
    if not isinstance(pages, dict):
        return jsonify({"data": None, "error": "pages object is required"}), 400

    budget = MAX_HEARTBEAT_SECONDS
    for raw_page, raw_seconds in pages.items():
        if budget <= 0:
            break
        if not str(raw_page).isdigit() or not isinstance(raw_seconds, (int, float)):
            continue
        page, seconds = int(raw_page), min(int(raw_seconds), budget)
        if not 1 <= page <= 10_000 or seconds <= 0:
            continue
        budget -= seconds
        row = SharePageView.query.filter_by(link_id=link.id, viewer_email=email, file_id=file_id, page=page).first()
        if row:
            row.seconds += seconds
        else:
            db.session.add(SharePageView(link_id=link.id, viewer_email=email, file_id=file_id,
                                         file_name=record.original_name, page=page, seconds=seconds))
    db.session.commit()
    return jsonify({"data": {"recorded": MAX_HEARTBEAT_SECONDS - budget}, "error": None}), 200


@shares_bp.route("/<int:link_id>/analytics", methods=["GET"])
@require_auth
def share_analytics(user: User, link_id: int) -> tuple[Response, int]:
    """Per-viewer and per-document engagement for one link, plus daily activity."""
    link = ShareLink.query.filter_by(id=link_id, user_id=user.id).first()
    if not link:
        return jsonify({"data": None, "error": "Link not found"}), 404

    accesses = link.accesses.all()
    page_views = link.page_views.all()
    viewers: dict[str, dict] = {}
    documents: dict[int, dict] = {}

    def viewer(email: str) -> dict:
        return viewers.setdefault(email, {"email": email, "opens": 0, "views": 0, "downloads": 0,
                                          "seconds": 0, "first_seen": None, "last_seen": None})

    def document(file_id: int, name: str) -> dict:
        return documents.setdefault(file_id, {"file_id": file_id, "file_name": name, "views": 0, "downloads": 0,
                                              "seconds": 0, "viewers": set(), "pages": {}})

    for a in accesses:
        v = viewer(a.viewer_email)
        v[{"opened": "opens", "viewed": "views", "downloaded": "downloads"}[a.action]] += 1
        stamp = a.created_at.isoformat()
        v["first_seen"] = min(v["first_seen"] or stamp, stamp)
        v["last_seen"] = max(v["last_seen"] or stamp, stamp)
        if a.file_id is not None:
            d = document(a.file_id, a.file_name or "")
            d["views" if a.action == "viewed" else "downloads"] += 1
            d["viewers"].add(a.viewer_email)

    for p in page_views:
        viewer(p.viewer_email)["seconds"] += p.seconds
        d = document(p.file_id, p.file_name)
        d["seconds"] += p.seconds
        d["viewers"].add(p.viewer_email)
        d["pages"][p.page] = d["pages"].get(p.page, 0) + p.seconds

    today = datetime.now(timezone.utc).date()
    daily = {(today - timedelta(days=i)).isoformat(): 0 for i in range(ANALYTICS_DAYS - 1, -1, -1)}
    for a in accesses:
        day = a.created_at.date().isoformat()
        if day in daily:
            daily[day] += 1

    docs = []
    for d in sorted(documents.values(), key=lambda d: (-d["seconds"], -d["views"])):
        pages = d.pop("pages")
        docs.append({**d, "viewers": len(d["viewers"]),
                     "pages": [{"page": n, "seconds": pages.get(n, 0)} for n in range(1, max(pages, default=0) + 1)]})

    return jsonify({"data": {
        "totals": {
            "viewers": len(viewers),
            "seconds": sum(p.seconds for p in page_views),
            "views": sum(1 for a in accesses if a.action == "viewed"),
            "downloads": sum(1 for a in accesses if a.action == "downloaded"),
        },
        "viewers": sorted(viewers.values(), key=lambda v: (-v["seconds"], v["email"])),
        "documents": docs,
        "daily": [{"date": day, "events": n} for day, n in daily.items()],
    }, "error": None}), 200
