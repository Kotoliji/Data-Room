from functools import wraps

from flask import Response, g, request, jsonify, current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app import db
from app.models import User, Session
from app.constants import SESSION_TOKEN_MAX_AGE


def generate_session_token(user_id: int, session_id: int) -> str:
    """Create a signed token containing user_id and session_id."""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    return serializer.dumps({"uid": user_id, "sid": session_id}, salt="session-auth")


SESSION_COOKIE = "dr_session"
CSRF_HEADER = "X-Requested-With"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def set_session_cookie(response: Response, token: str) -> Response:
    """Browsers keep the session in an HttpOnly cookie that page scripts cannot read."""
    response.set_cookie(SESSION_COOKIE, token, max_age=SESSION_TOKEN_MAX_AGE, httponly=True,
                        secure=request.is_secure, samesite="Lax", path="/api")
    return response


def clear_session_cookie(response: Response) -> Response:
    response.delete_cookie(SESSION_COOKIE, path="/api", samesite="Lax")
    return response


def get_user_from_header() -> User | None:
    """Resolve the user from a Bearer token (API clients) or the session cookie (browser)."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    else:
        token = request.cookies.get(SESSION_COOKIE, "")
        if not token:
            return None
        # Cookies ride along on cross-site requests; a custom header cannot be sent cross-site
        # without passing CORS, so unsafe requests must carry it (SameSite=Lax is the first line)
        if request.method not in SAFE_METHODS and request.headers.get(CSRF_HEADER) != "dataroom":
            g.csrf_rejected = True
            return None
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

    g.session_id = session_id  # lets handlers tell the caller's session apart from the others

    return db.session.get(User, user_id)


def is_demo_account(user: User) -> bool:
    """The public demo login must stay usable for everyone, so account-level changes are blocked."""
    from app.demo import DEMO_EMAIL
    return bool(current_app.config.get("DEMO_SEED")) and user.email == DEMO_EMAIL


def demo_locked():
    return jsonify({"data": None, "error": "This is disabled for the shared demo account"}), 403


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_user_from_header()
        if not user:
            if g.get("csrf_rejected"):
                return jsonify({"data": None, "error": "Missing CSRF header"}), 403
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
