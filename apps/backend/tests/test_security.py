import pytest

from app import create_app, db
from app.models import Session, User
from tests.conftest import upload, view


def test_weak_secret_key_refused(monkeypatch, tmp_path):
    monkeypatch.setenv("SECRET_KEY", "short")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'x.db'}")
    with pytest.raises(RuntimeError):
        create_app()


def test_google_tokens_encrypted_at_rest(app, auth):
    with app.app_context():
        user = db.session.get(User, 1)
        user.google_access_token = "ya29.secret"
        db.session.commit()
        raw = db.session.execute(db.text("SELECT google_access_token FROM users")).scalar()
        assert raw.startswith("fernet:") and "ya29" not in raw
        db.session.expire_all()
        assert db.session.get(User, 1).google_access_token == "ya29.secret"


def test_legacy_plaintext_token_still_readable(app, auth):
    with app.app_context():
        db.session.execute(db.text("UPDATE users SET google_refresh_token = 'legacy'"))
        db.session.commit()
        assert db.session.get(User, 1).google_refresh_token == "legacy"


def test_spoofed_content_type_is_ignored(client, auth):
    r = upload(client, auth, "evil.pdf", b"<script>alert(1)</script>", "text/html")
    v = view(client, auth, r.get_json()["data"]["files"][0]["id"])
    assert v.mimetype == "application/pdf"
    assert v.headers["X-Content-Type-Options"] == "nosniff"


def test_svg_is_downloaded_in_sandbox(client, auth):
    r = upload(client, auth, "pic.svg", b"<svg onload=alert(1)>", "image/svg+xml")
    v = view(client, auth, r.get_json()["data"]["files"][0]["id"])
    assert "attachment" in v.headers["Content-Disposition"]
    assert v.mimetype == "application/octet-stream"
    assert "sandbox" in v.headers["Content-Security-Policy"]


def test_view_token_bound_to_file(client, auth):
    a = upload(client, auth, "a.txt", b"a", "text/plain").get_json()["data"]["files"][0]["id"]
    b = upload(client, auth, "b.txt", b"b", "text/plain").get_json()["data"]["files"][0]["id"]
    url = client.get(f"/api/v1/files/{a}/token", headers=auth).get_json()["data"]["url"]
    token = url.split("token=")[1]
    assert client.get(f"/api/v1/files/{b}/view?token={token}").status_code == 403
    assert client.get(f"/api/v1/files/{a}/view").status_code == 403


def test_login_is_rate_limited(client, auth):
    codes = [client.post("/api/v1/auth/login", json={"email": "owner@acme.io", "password": "wrong"}).status_code
             for _ in range(11)]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429


def test_client_ip_from_single_proxy_hop(app, client):
    client.post("/api/v1/auth/register", json={"name": "A", "email": "ip@acme.io", "password": "password123"},
                headers={"X-Forwarded-For": "203.0.113.7"})
    with app.app_context():
        assert db.session.get(Session, 1).ip == "203.0.113.7"


def test_client_ip_behind_render_proxy_chain(monkeypatch, tmp_path):
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-0123456789")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'p.db'}")
    monkeypatch.setenv("RENDER", "true")  # host default, no PROXY_HOPS needed
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path / "storage"))
    app = create_app()
    c = app.test_client()
    # A spoofed entry prepended by the client is ignored; scheme still comes from the single proto header
    c.post("/api/v1/auth/register", json={"name": "A", "email": "a@acme.io", "password": "password123"},
           headers={"X-Forwarded-For": "6.6.6.6, 188.80.213.223, 172.71.147.59, 10.193.150.1", "X-Forwarded-Proto": "https"})
    with app.app_context():
        assert db.session.get(Session, 1).ip == "188.80.213.223"
        db.engine.dispose()
    proxied = {"X-Forwarded-For": "1.1.1.1, 2.2.2.2, 3.3.3.3", "X-Forwarded-Proto": "https"}
    token = c.post("/api/v1/auth/login", json={"email": "a@acme.io", "password": "password123"}, headers=proxied).get_json()["data"]["token"]
    auth = {"Authorization": f"Bearer {token}", **proxied}
    fid = upload(c, auth, "a.txt", b"a", "text/plain").get_json()["data"]["files"][0]["id"]
    assert c.get(f"/api/v1/files/{fid}/token", headers=auth).get_json()["data"]["url"].startswith("https://")
