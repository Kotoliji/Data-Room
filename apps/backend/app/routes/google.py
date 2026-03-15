import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from flask import Blueprint, Response, request, jsonify, current_app, redirect
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app import db
from app.models import User, Session
from app.utils import require_auth, parse_device, generate_session_token
from app.constants import GOOGLE_AUTH_URI, GOOGLE_TOKEN_URI, OAUTH_STATE_MAX_AGE, GOOGLE_AUTH_VERIFY_MAX_AGE

# One-time authorization codes for Google login (code → {data, created_at})
_pending_google_auth: dict[str, dict] = {}
_GOOGLE_CODE_MAX_AGE = 120  # seconds
_MAX_PENDING_CODES = 100  # safety cap to prevent memory growth


def _purge_expired_codes() -> None:
    """Remove expired codes and enforce max size."""
    now = datetime.now(timezone.utc)
    expired = [k for k, v in _pending_google_auth.items()
               if (now - v["created_at"]).total_seconds() > _GOOGLE_CODE_MAX_AGE]
    for k in expired:
        del _pending_google_auth[k]
    # If still over cap, remove oldest entries
    while len(_pending_google_auth) > _MAX_PENDING_CODES:
        oldest_key = min(_pending_google_auth, key=lambda k: _pending_google_auth[k]["created_at"])
        del _pending_google_auth[oldest_key]

google_bp = Blueprint("google", __name__)

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
LOGIN_SCOPES = ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"]


def _get_serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"])


def _build_flow(redirect_uri: str, scopes: list[str]) -> Flow:
    client_config = {
        "web": {
            "client_id": current_app.config["GOOGLE_CLIENT_ID"],
            "client_secret": current_app.config["GOOGLE_CLIENT_SECRET"],
            "auth_uri": GOOGLE_AUTH_URI,
            "token_uri": GOOGLE_TOKEN_URI,
        }
    }
    flow = Flow.from_client_config(client_config, scopes=scopes)
    flow.redirect_uri = redirect_uri
    return flow


def _redirect_uri() -> str:
    backend_url = current_app.config["BACKEND_URL"]
    return f"{backend_url}/api/v1/auth/google/callback"


@google_bp.route("/google/connect", methods=["GET"])
@require_auth
def google_connect(user: User) -> tuple[Response, int]:
    flow = _build_flow(_redirect_uri(), SCOPES)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=_get_serializer().dumps({"user_id": user.id}),
    )

    current_app.logger.info("Google OAuth started for user %s", user.id)
    return jsonify({"data": {"auth_url": auth_url}, "error": None}), 200


@google_bp.route("/google/callback", methods=["GET"])
def google_callback() -> Response:
    frontend_url = current_app.config["FRONTEND_URL"]

    error = request.args.get("error")
    if error:
        current_app.logger.warning("Google OAuth denied: %s", error)
        return redirect(f"{frontend_url}/?google_connected=false&error={quote(error)}")

    code = request.args.get("code")
    state_raw = request.args.get("state", "")

    try:
        state = _get_serializer().loads(state_raw, max_age=OAUTH_STATE_MAX_AGE)
        user_id = int(state["user_id"])
    except (BadSignature, SignatureExpired, KeyError, ValueError, TypeError):
        current_app.logger.error("Invalid OAuth state: %s", state_raw)
        return redirect(f"{frontend_url}/?google_connected=false&error=invalid_state")

    user = db.session.get(User, user_id)
    if not user:
        current_app.logger.error("User %s not found during OAuth callback", user_id)
        return redirect(f"{frontend_url}/?google_connected=false&error=user_not_found")

    try:
        flow = _build_flow(_redirect_uri(), SCOPES)
        flow.fetch_token(code=code)
    except Exception:
        current_app.logger.exception("Failed to exchange Google auth code")
        return redirect(f"{frontend_url}/?google_connected=false&error=token_exchange_failed")

    credentials = flow.credentials
    user.google_access_token = credentials.token
    user.google_refresh_token = credentials.refresh_token
    user.google_token_expiry = credentials.expiry.replace(tzinfo=timezone.utc) if credentials.expiry else None
    user.google_connected = True
    db.session.commit()

    current_app.logger.info("Google Drive connected for user %s", user.id)
    return redirect(f"{frontend_url}/?google_connected=true")


@google_bp.route("/google/status", methods=["GET"])
@require_auth
def google_status(user: User) -> tuple[Response, int]:
    return jsonify({"data": {"connected": user.google_connected}, "error": None}), 200


@google_bp.route("/google/disconnect", methods=["POST"])
@require_auth
def google_disconnect(user: User) -> tuple[Response, int]:
    user.google_access_token = None
    user.google_refresh_token = None
    user.google_token_expiry = None
    user.google_connected = False
    db.session.commit()

    current_app.logger.info("Google Drive disconnected for user %s", user.id)
    return jsonify({"data": {"message": "Google Drive disconnected"}, "error": None}), 200


# --------------- Google Login / Register ---------------

def _login_redirect_uri() -> str:
    backend_url = current_app.config["BACKEND_URL"]
    return f"{backend_url}/api/v1/auth/google/login/callback"


@google_bp.route("/google/login", methods=["GET"])
def google_login() -> Response:
    """Start Google OAuth for login/register."""
    mode = request.args.get("mode", "login")  # "login" or "register"

    flow = _build_flow(_login_redirect_uri(), LOGIN_SCOPES)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="select_account",
        state=_get_serializer().dumps({"mode": mode}),
    )

    return redirect(auth_url)


@google_bp.route("/google/login/callback", methods=["GET"])
def google_login_callback() -> Response:
    """Handle Google OAuth callback for login/register."""
    frontend_url = current_app.config["FRONTEND_URL"]

    error = request.args.get("error")
    if error:
        current_app.logger.warning("Google login denied: %s", error)
        return redirect(f"{frontend_url}/login?google_error={quote(error)}")

    code = request.args.get("code")
    state_raw = request.args.get("state", "")

    try:
        state = _get_serializer().loads(state_raw, max_age=OAUTH_STATE_MAX_AGE)
        mode = state.get("mode", "login")
    except (BadSignature, SignatureExpired):
        return redirect(f"{frontend_url}/login?google_error=invalid_state")

    # Exchange code for tokens
    try:
        flow = _build_flow(_login_redirect_uri(), LOGIN_SCOPES)
        flow.fetch_token(code=code)
    except Exception:
        current_app.logger.exception("Failed to exchange Google login code")
        return redirect(f"{frontend_url}/login?google_error=token_exchange_failed")

    # Get user info from id_token
    credentials = flow.credentials
    try:
        id_info = id_token.verify_oauth2_token(
            credentials.id_token,
            google_requests.Request(),
            current_app.config["GOOGLE_CLIENT_ID"],
        )
    except Exception:
        current_app.logger.exception("Failed to verify Google id_token")
        return redirect(f"{frontend_url}/login?google_error=verification_failed")

    google_email = id_info.get("email", "").lower()
    google_name = id_info.get("name", "")

    if not google_email:
        return redirect(f"{frontend_url}/login?google_error=no_email")

    user = User.query.filter_by(email=google_email).first()

    if mode == "register":
        if user:
            # Already exists — redirect to login with message
            return redirect(f"{frontend_url}/login?google_error=account_exists&google_email={quote(google_email)}")

        # Redirect to register page with signed token — user needs to set password
        google_reg_token = _get_serializer().dumps({"name": google_name, "email": google_email})
        return redirect(f"{frontend_url}/register?google_reg={google_reg_token}")

    # mode == "login"
    if not user:
        return redirect(f"{frontend_url}/login?google_error=no_account&google_email={quote(google_email)}")

    # Create session and log in
    ua = request.headers.get("User-Agent", "")
    ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    session = Session(user_id=user.id, device=parse_device(ua), ip=ip)
    db.session.add(session)
    db.session.commit()

    current_app.logger.info("Google login for user %s", user.email)

    # Generate one-time code — frontend exchanges it via POST for the real token
    avatar_url = f"/api/v1/auth/avatar/{user.id}" if user.avatar_path else None
    auth_token = generate_session_token(user.id, session.id)

    _purge_expired_codes()
    code = secrets.token_urlsafe(32)
    _pending_google_auth[code] = {
        "data": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "avatar_url": avatar_url,
            "session_id": session.id,
            "token": auth_token,
        },
        "created_at": datetime.now(timezone.utc),
    }

    return redirect(f"{frontend_url}/login?google_code={code}")


@google_bp.route("/google/exchange", methods=["POST"])
def google_exchange() -> tuple[Response, int]:
    """Exchange a one-time Google login code for user data + auth token."""
    body = request.get_json(silent=True) or {}
    code = body.get("code", "")
    if not code:
        return jsonify({"data": None, "error": "Code is required"}), 400

    _purge_expired_codes()
    now = datetime.now(timezone.utc)

    entry = _pending_google_auth.get(code)
    if not entry:
        return jsonify({"data": None, "error": "Invalid or expired code"}), 400

    if (now - entry["created_at"]).total_seconds() > _GOOGLE_CODE_MAX_AGE:
        _pending_google_auth.pop(code, None)
        return jsonify({"data": None, "error": "Code expired"}), 400

    # Mark as used — allow brief replay for React StrictMode double-calls
    if not entry.get("used"):
        entry["used"] = True
        entry["used_at"] = now
    elif (now - entry["used_at"]).total_seconds() > 5:
        _pending_google_auth.pop(code, None)
        return jsonify({"data": None, "error": "Code already used"}), 400

    return jsonify({"data": entry["data"], "error": None}), 200


@google_bp.route("/google/verify", methods=["GET"])
def google_verify() -> tuple[Response, int]:
    """Verify signed google_reg token (used for registration prefill only)."""
    token = request.args.get("token", "")
    if not token:
        return jsonify({"data": None, "error": "Token is required"}), 400

    try:
        user_data = _get_serializer().loads(token, max_age=GOOGLE_AUTH_VERIFY_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return jsonify({"data": None, "error": "Invalid or expired token"}), 400

    return jsonify({"data": user_data, "error": None}), 200
