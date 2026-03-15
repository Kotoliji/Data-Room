from functools import wraps

from flask import request, jsonify, current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app import db
from app.models import User, Session
from app.constants import SESSION_TOKEN_MAX_AGE


def generate_session_token(user_id: int, session_id: int) -> str:
    """Create a signed token containing user_id and session_id."""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    return serializer.dumps({"uid": user_id, "sid": session_id}, salt="session-auth")


def get_user_from_header() -> User | None:
    """Extract and validate user from Authorization Bearer token."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    try:
        data = serializer.loads(token, salt="session-auth", max_age=SESSION_TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None

    user_id = data.get("uid")
    session_id = data.get("sid")
    if not user_id or not session_id:
        return None

    # Verify session is still active
    session = db.session.get(Session, session_id)
    if not session or not session.is_active or session.user_id != user_id:
        return None

    return db.session.get(User, user_id)


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_user_from_header()
        if not user:
            return jsonify({"data": None, "error": "Unauthorized"}), 401
        return f(user, *args, **kwargs)
    return decorated


def parse_device(user_agent: str) -> str:
    """Parse User-Agent string into a human-readable device description."""
    ua = user_agent.lower()

    if "edg" in ua:
        browser = "Edge"
    elif "chrome" in ua:
        browser = "Chrome"
    elif "safari" in ua:
        browser = "Safari"
    elif "firefox" in ua:
        browser = "Firefox"
    else:
        browser = "Browser"

    # Mobile checks first — mobile UAs often contain "Linux"
    if "iphone" in ua:
        os_name = "iPhone"
    elif "ipad" in ua:
        os_name = "iPad"
    elif "android" in ua:
        os_name = "Android"
    elif "macintosh" in ua or "mac os" in ua:
        os_name = "Mac"
    elif "windows" in ua:
        os_name = "Windows"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "Unknown"

    return f"{browser} on {os_name}"
