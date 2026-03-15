import os
import time
from pathlib import Path

from flask import Blueprint, Response, request, jsonify, current_app, send_file
from sqlalchemy.exc import IntegrityError
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from werkzeug.utils import secure_filename

from app import db
from app.models import User, Session, File, Folder, ActivityLog
from app.services.email_service import send_reset_email
from app.utils import require_auth, parse_device, generate_session_token
from app.constants import PASSWORD_RESET_TOKEN_MAX_AGE

auth_bp = Blueprint("auth", __name__)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB
STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage" / "avatars"


def _avatar_url(user: User) -> str | None:
    if user.avatar_path:
        return f"/api/v1/auth/avatar/{user.id}"
    return None


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "location": user.location,
        "avatar_url": _avatar_url(user),
    }



# --------------- Auth endpoints ---------------

@auth_bp.route("/register", methods=["POST"])
def register() -> tuple[Response, int]:
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"data": None, "error": "Name, email and password are required"}), 400

    if len(password) < 8:
        return jsonify({"data": None, "error": "Password must be at least 8 characters"}), 400

    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"data": None, "error": "Email already exists"}), 409

    ua = request.headers.get("User-Agent", "")
    ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    session = Session(user_id=user.id, device=parse_device(ua), ip=ip)
    db.session.add(session)
    db.session.commit()

    current_app.logger.info("User registered: %s", email)
    token = generate_session_token(user.id, session.id)
    return jsonify({"data": {**_user_dict(user), "session_id": session.id, "token": token}, "error": None}), 201


@auth_bp.route("/login", methods=["POST"])
def login() -> tuple[Response, int]:
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"data": None, "error": "Invalid email or password"}), 401

    ua = request.headers.get("User-Agent", "")
    ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    session = Session(user_id=user.id, device=parse_device(ua), ip=ip)
    db.session.add(session)
    db.session.commit()

    current_app.logger.info("User logged in: %s", email)
    token = generate_session_token(user.id, session.id)
    return jsonify({"data": {**_user_dict(user), "session_id": session.id, "token": token}, "error": None}), 200


# --------------- Profile endpoints ---------------

@auth_bp.route("/me", methods=["GET"])
@require_auth
def me(user: User) -> tuple[Response, int]:
    return jsonify({"data": _user_dict(user), "error": None}), 200


@auth_bp.route("/profile", methods=["PUT"])
@require_auth
def update_profile(user: User) -> tuple[Response, int]:
    data = request.get_json(silent=True) or {}

    if "name" in data:
        name = data["name"]
        if not isinstance(name, str) or not name.strip():
            return jsonify({"data": None, "error": "Name cannot be empty"}), 400
        user.name = name.strip()

    if "email" in data:
        email = data["email"]
        if not isinstance(email, str) or not email.strip() or "@" not in email:
            return jsonify({"data": None, "error": "Valid email is required"}), 400
        email = email.strip().lower()
        existing = User.query.filter(User.email == email, User.id != user.id).first()
        if existing:
            return jsonify({"data": None, "error": "Email already in use"}), 409
        user.email = email

    if "location" in data:
        location = data["location"]
        if location is not None and not isinstance(location, str):
            return jsonify({"data": None, "error": "Location must be a string"}), 400
        user.location = location.strip() if location else None

    db.session.commit()
    current_app.logger.info("Profile updated for user %s", user.id)
    return jsonify({"data": _user_dict(user), "error": None}), 200


@auth_bp.route("/avatar", methods=["POST"])
@require_auth
def upload_avatar(user: User) -> tuple[Response, int]:
    if "avatar" not in request.files:
        return jsonify({"data": None, "error": "No avatar file provided"}), 400

    file = request.files["avatar"]
    if not file.filename:
        return jsonify({"data": None, "error": "No avatar file provided"}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"data": None, "error": "Only jpg, png, gif files are allowed"}), 400

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > MAX_AVATAR_SIZE:
        return jsonify({"data": None, "error": "File size exceeds 5MB limit"}), 400

    # Delete old avatar if exists
    if user.avatar_path:
        old_path = Path(user.avatar_path)
        if old_path.exists():
            try:
                old_path.unlink()
            except OSError:
                current_app.logger.warning("Failed to delete old avatar: %s", old_path)

    # Save new avatar
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{user.id}_{int(time.time())}.{ext}"
    filepath = STORAGE_DIR / secure_filename(filename)
    file.save(str(filepath))

    user.avatar_path = str(filepath)
    db.session.commit()

    current_app.logger.info("Avatar uploaded for user %s", user.id)
    return jsonify({
        "data": {"avatar_url": f"/api/v1/auth/avatar/{user.id}"},
        "error": None,
    }), 200


@auth_bp.route("/avatar/<int:user_id>", methods=["GET"])
def get_avatar(user_id: int) -> tuple[Response, int] | Response:
    user = db.session.get(User, user_id)
    if not user or not user.avatar_path:
        return jsonify({"data": None, "error": "Avatar not found"}), 404

    avatar_path = Path(user.avatar_path)
    if not avatar_path.resolve().is_relative_to(STORAGE_DIR.resolve()):
        return jsonify({"data": None, "error": "Forbidden"}), 403

    if not avatar_path.exists():
        return jsonify({"data": None, "error": "Avatar not found"}), 404

    ext = avatar_path.suffix.lower().lstrip(".")
    mime_map = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
    }

    return send_file(str(avatar_path), mimetype=mime_map.get(ext, "application/octet-stream"))


# --------------- Password reset endpoints ---------------

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password() -> tuple[Response, int]:
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()

    safe_response = jsonify({
        "data": {"message": "If this email exists, a reset link has been sent"},
        "error": None,
    }), 200

    if not email:
        return safe_response

    user = User.query.filter_by(email=email).first()
    if not user:
        return safe_response

    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    # Include password_hash prefix so token is invalidated once password changes
    token = serializer.dumps({"uid": user.id, "ph": user.password_hash[:8]}, salt="password-reset")
    frontend_url = current_app.config.get("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={token}"

    try:
        send_reset_email(user.email, reset_link)
    except Exception:
        current_app.logger.exception("Error sending reset email for %s", email)

    return safe_response


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password() -> tuple[Response, int]:
    data = request.get_json(silent=True) or {}
    token = data.get("token", "")
    password = data.get("password", "")

    if not password:
        return jsonify({"data": None, "error": "Password is required"}), 400

    if len(password) < 8:
        return jsonify({"data": None, "error": "Password must be at least 8 characters"}), 400

    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    try:
        payload = serializer.loads(token, salt="password-reset", max_age=PASSWORD_RESET_TOKEN_MAX_AGE)
    except (SignatureExpired, BadSignature):
        return jsonify({"data": None, "error": "Invalid or expired reset link"}), 400

    # Support both old (plain user_id) and new (dict with uid + ph) token formats
    if isinstance(payload, dict):
        user_id = payload.get("uid")
        pw_hash_prefix = payload.get("ph")
    else:
        user_id = payload
        pw_hash_prefix = None

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"data": None, "error": "Invalid or expired reset link"}), 400

    # If token contains password hash prefix, verify it matches current hash (prevents replay)
    if pw_hash_prefix and user.password_hash[:8] != pw_hash_prefix:
        return jsonify({"data": None, "error": "This reset link has already been used"}), 400

    user.set_password(password)
    db.session.commit()

    current_app.logger.info("Password reset for user: %s", user.email)
    return jsonify({
        "data": {"message": "Password has been reset"},
        "error": None,
    }), 200


@auth_bp.route("/password", methods=["PUT"])
@require_auth
def change_password(user: User) -> tuple[Response, int]:
    data = request.get_json(silent=True) or {}
    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "")

    if not old_password or not new_password:
        return jsonify({"data": None, "error": "Old password and new password are required"}), 400

    if not user.check_password(old_password):
        return jsonify({"data": None, "error": "Old password is incorrect"}), 400

    if len(new_password) < 8:
        return jsonify({"data": None, "error": "Password must be at least 8 characters"}), 400

    user.set_password(new_password)
    db.session.commit()

    current_app.logger.info("Password changed for user %s", user.id)
    return jsonify({
        "data": {"message": "Password changed successfully"},
        "error": None,
    }), 200


# --------------- Session endpoints ---------------

@auth_bp.route("/sessions", methods=["GET"])
@require_auth
def list_sessions(user: User) -> tuple[Response, int]:
    sessions = (
        Session.query
        .filter_by(user_id=user.id, is_active=True)
        .order_by(Session.created_at.desc())
        .all()
    )
    data = [
        {
            "id": s.id,
            "device": s.device,
            "ip": s.ip,
            "created_at": s.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if s.created_at else None,
        }
        for s in sessions
    ]
    return jsonify({"data": data, "error": None}), 200


@auth_bp.route("/sessions/<int:session_id>", methods=["DELETE"])
@require_auth
def revoke_session(user: User, session_id: int) -> tuple[Response, int]:
    session = db.session.get(Session, session_id)
    if not session or session.user_id != user.id:
        return jsonify({"data": None, "error": "Session not found"}), 404

    session.is_active = False
    db.session.commit()

    current_app.logger.info("Session %s revoked for user %s", session_id, user.id)
    return jsonify({"data": {"message": "Session revoked"}, "error": None}), 200


@auth_bp.route("/sessions", methods=["DELETE"])
@require_auth
def revoke_all_sessions(user: User) -> tuple[Response, int]:
    Session.query.filter_by(user_id=user.id, is_active=True).update({"is_active": False})
    db.session.commit()

    current_app.logger.info("All sessions revoked for user %s", user.id)
    return jsonify({"data": {"message": "All sessions revoked"}, "error": None}), 200


@auth_bp.route("/account", methods=["DELETE"])
@require_auth
def delete_account(user: User) -> tuple[Response, int]:
    data = request.get_json(silent=True) or {}
    password = data.get("password", "")

    if not password or not user.check_password(password):
        return jsonify({"data": None, "error": "Invalid password"}), 400

    # Delete all related records
    ActivityLog.query.filter_by(user_id=user.id).delete()
    Session.query.filter_by(user_id=user.id).delete()
    Folder.query.filter_by(user_id=user.id).delete()

    # Delete user files from disk
    user_files = File.query.filter_by(user_id=user.id).all()
    for f in user_files:
        try:
            p = Path(f.path)
            if p.exists():
                p.unlink()
        except OSError:
            current_app.logger.warning("Could not delete file on disk: %s", f.path)
    File.query.filter_by(user_id=user.id).delete()

    # Delete avatar file from disk if exists
    if user.avatar_path:
        avatar_path = Path(user.avatar_path)
        if avatar_path.exists():
            try:
                avatar_path.unlink()
            except OSError:
                current_app.logger.warning("Failed to delete avatar: %s", avatar_path)

    user_email = user.email
    db.session.delete(user)
    db.session.commit()

    current_app.logger.info("Account deleted: %s", user_email)
    return jsonify({"data": {"message": "Account deleted"}, "error": None}), 200
