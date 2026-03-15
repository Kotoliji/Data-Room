import os
import uuid
from pathlib import Path

from flask import Blueprint, Response, request, jsonify, current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from werkzeug.utils import secure_filename

from app import db
from app.models import User, File, Folder
from app.services.activity_service import log_activity
from app.services.file_service import storage_dir
from app.utils import require_auth
from app.constants import MAX_FILE_SIZE, FILE_VIEW_TOKEN_MAX_AGE

files_bp = Blueprint("files", __name__)
MAX_FILES_PER_REQUEST = 20
ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "csv", "jpg", "jpeg", "png", "gif", "svg", "zip",
}


def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@files_bp.route("/upload", methods=["POST"])
@require_auth
def upload_files(user: User) -> tuple[Response, int]:
    uploaded = request.files.getlist("files")
    if not uploaded:
        return jsonify({"data": None, "error": "No files provided"}), 400

    if len(uploaded) > MAX_FILES_PER_REQUEST:
        return jsonify({"data": None, "error": f"Maximum {MAX_FILES_PER_REQUEST} files per upload"}), 400

    folder_id = request.form.get("folder_id", "all")
    storage = storage_dir(user.id)
    results = []
    skipped = []

    for f in uploaded:
        if not f.filename:
            continue

        if not _allowed_file(f.filename):
            current_app.logger.warning("Rejected file type: %s", f.filename)
            skipped.append({"name": f.filename, "reason": "File type not allowed"})
            continue

        f.seek(0, os.SEEK_END)
        size = f.tell()
        f.seek(0)

        if size > MAX_FILE_SIZE:
            current_app.logger.warning("File too large: %s (%d bytes)", f.filename, size)
            skipped.append({"name": f.filename, "reason": "File exceeds 50MB limit"})
            continue

        original = secure_filename(f.filename) or "unnamed"
        unique = f"{uuid.uuid4().hex}_{original}"
        path = storage / unique
        f.save(str(path))

        record = File(
            name=original,
            original_name=f.filename,
            mime_type=f.content_type,
            size=size,
            path=str(path),
            folder_id=folder_id,
            user_id=user.id,
            status="uploaded",
        )
        db.session.add(record)
        results.append(record)

    for r in results:
        log_activity(user.id, "uploaded", r.original_name, folder_id=r.folder_id)
    db.session.commit()

    current_app.logger.info("Uploaded %d files for user %s", len(results), user.id)
    return jsonify({
        "data": {
            "files": [r.to_dict() for r in results],
            "skipped": skipped,
        },
        "error": None,
    }), 200


@files_bp.route("", methods=["GET"])
@require_auth
def list_files(user: User) -> tuple[Response, int]:
    folder_id = request.args.get("folder_id")
    query = File.query.filter_by(user_id=user.id)
    if folder_id:
        query = query.filter_by(folder_id=folder_id)

    files = query.order_by(File.created_at.desc()).all()
    return jsonify({
        "data": {
            "files": [f.to_dict() for f in files]
        },
        "error": None,
    }), 200


@files_bp.route("/<int:file_id>/token", methods=["GET"])
@require_auth
def get_file_token(user: User, file_id: int) -> tuple[Response, int]:
    record = File.query.filter_by(id=file_id, user_id=user.id).first()
    if not record:
        return jsonify({"data": None, "error": "File not found"}), 404

    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    token = serializer.dumps({"file_id": file_id, "user_id": user.id}, salt="file-view")

    return jsonify({
        "data": {"url": f"{request.host_url.rstrip('/')}/api/v1/files/{file_id}/view?token={token}"},
        "error": None,
    }), 200


@files_bp.route("/<int:file_id>/view", methods=["GET"])
def view_file(file_id: int) -> Response:
    token = request.args.get("token")
    user = None

    if token:
        # Validate signed token (60-second TTL)
        serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
        try:
            data = serializer.loads(token, salt="file-view", max_age=FILE_VIEW_TOKEN_MAX_AGE)
        except (BadSignature, SignatureExpired):
            return jsonify({"data": None, "error": "Invalid or expired file token"}), 403

        if data.get("file_id") != file_id:
            return jsonify({"data": None, "error": "Token does not match this file"}), 403

        user = db.session.get(User, data.get("user_id"))
    else:
        return jsonify({"data": None, "error": "File token is required"}), 403

    if not user:
        return jsonify({"data": None, "error": "User not found"}), 404

    record = File.query.filter_by(id=file_id, user_id=user.id).first()
    if not record:
        return jsonify({"data": None, "error": "File not found"}), 404

    file_path = Path(record.path).resolve()
    allowed_dir = storage_dir(user.id).resolve()
    if not file_path.is_relative_to(allowed_dir):
        current_app.logger.warning("Path traversal attempt: %s (user %s)", record.path, user.id)
        return jsonify({"data": None, "error": "Forbidden"}), 403

    if not file_path.exists():
        return jsonify({"data": None, "error": "File not found on disk"}), 404

    from flask import send_file

    # Inline-viewable types open in browser, others download
    inline_mimes = {
        "application/pdf",
        "text/plain", "text/csv", "text/html",
        "image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp",
    }
    mime = record.mime_type or "application/octet-stream"
    as_attachment = mime not in inline_mimes

    return send_file(
        str(file_path),
        mimetype=mime,
        download_name=record.original_name,
        as_attachment=as_attachment,
    )


@files_bp.route("/<int:file_id>/move", methods=["PUT"])
@require_auth
def move_file(user: User, file_id: int) -> tuple[Response, int]:
    data = request.get_json()
    folder_id = data.get("folder_id") if data else None
    if not folder_id:
        return jsonify({"data": None, "error": "folder_id is required"}), 400

    # Validate target folder exists and belongs to user
    if folder_id not in ("all", "Trash"):
        if folder_id.startswith("folder:"):
            try:
                fid = int(folder_id.split(":")[1])
            except (IndexError, ValueError):
                return jsonify({"data": None, "error": "Invalid folder_id"}), 400
            if not Folder.query.filter_by(id=fid, user_id=user.id).first():
                return jsonify({"data": None, "error": "Folder not found"}), 404
        else:
            return jsonify({"data": None, "error": "Invalid folder_id"}), 400

    record = File.query.filter_by(id=file_id, user_id=user.id).first()
    if not record:
        return jsonify({"data": None, "error": "File not found"}), 404

    old_folder = record.folder_id
    if folder_id == "Trash" and old_folder != "Trash":
        record.original_folder_id = old_folder
    elif folder_id != "Trash" and old_folder == "Trash":
        record.original_folder_id = None
    record.folder_id = folder_id
    log_activity(user.id, "moved", record.original_name, folder_id=folder_id, details=f"from {old_folder} to {folder_id}")
    db.session.commit()

    current_app.logger.info("Moved file %d to folder '%s'", file_id, folder_id)
    return jsonify({"data": record.to_dict(), "error": None}), 200


@files_bp.route("/<int:file_id>/rename", methods=["PUT"])
@require_auth
def rename_file(user: User, file_id: int) -> tuple[Response, int]:
    data = request.get_json()
    new_name = data.get("name", "").strip() if data else ""
    if not new_name:
        return jsonify({"data": None, "error": "Name is required"}), 400

    record = File.query.filter_by(id=file_id, user_id=user.id).first()
    if not record:
        return jsonify({"data": None, "error": "File not found"}), 404

    old_name = record.original_name
    record.original_name = new_name
    log_activity(user.id, "renamed", new_name, folder_id=record.folder_id, details=f"from {old_name}")
    db.session.commit()

    current_app.logger.info("Renamed file %d to '%s'", file_id, new_name)
    return jsonify({"data": record.to_dict(), "error": None}), 200


@files_bp.route("/<int:file_id>", methods=["DELETE"])
@require_auth
def delete_file(user: User, file_id: int) -> tuple[Response, int]:
    record = File.query.filter_by(id=file_id, user_id=user.id).first()
    if not record:
        return jsonify({"data": None, "error": "File not found"}), 404

    try:
        path = Path(record.path).resolve()
        allowed_dir = storage_dir(user.id).resolve()
        if not path.is_relative_to(allowed_dir):
            current_app.logger.warning("Path traversal attempt on delete: %s (user %s)", record.path, user.id)
            return jsonify({"data": None, "error": "Forbidden"}), 403
        if path.exists():
            path.unlink()
    except OSError:
        current_app.logger.warning("Could not delete file on disk: %s", record.path)

    file_name = record.original_name
    file_folder = record.folder_id
    db.session.delete(record)
    log_activity(user.id, "deleted", file_name, folder_id=file_folder)
    db.session.commit()

    current_app.logger.info("Deleted file %d for user %s", file_id, user.id)
    return jsonify({"data": {"message": "File deleted"}, "error": None}), 200
