from app import create_app, db
from app.demo import DEMO_EMAIL, DEMO_PASSWORD, DEMO_SHARE_TOKEN
from app.models import File, User


def demo_app(tmp_path, monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-0123456789")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'demo.db'}")
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path / "storage"))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    monkeypatch.setenv("INSIGHTS_ASYNC", "0")
    monkeypatch.setenv("DEMO_SEED", "1")
    return create_app()


def test_demo_room_is_seeded_once_and_usable(tmp_path, monkeypatch):
    app = demo_app(tmp_path, monkeypatch)
    demo_app(tmp_path, monkeypatch)  # a restart on the same database must not duplicate anything
    with app.app_context():
        assert User.query.filter_by(email=DEMO_EMAIL).count() == 1
        files = File.query.all()
        assert len(files) == 8 and all(f.insight.status == "ready" for f in files)
        db.engine.dispose()

    c = app.test_client()
    token = c.post("/api/v1/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}).get_json()["data"]["token"]
    auth = {"Authorization": f"Bearer {token}"}

    # Investor link works and already has analytics and questions
    access = c.post(f"/api/v1/public/shares/{DEMO_SHARE_TOKEN}/unlock", json={"email": "me@test.dev"}).get_json()["data"]["access_token"]
    root = c.get(f"/api/v1/public/shares/{DEMO_SHARE_TOKEN}/contents", headers={"X-Share-Access": access}).get_json()["data"]
    assert len(root["folders"]) == 4
    link_id = c.get("/api/v1/shares", headers=auth).get_json()["data"]["shares"][0]["id"]
    assert c.get(f"/api/v1/shares/{link_id}/analytics", headers=auth).get_json()["data"]["totals"]["viewers"] >= 3
    assert c.get("/api/v1/questions", headers=auth).get_json()["data"]["open_count"] == 1

    # Sensitive document is flagged by the heuristics
    sensitive = c.get("/api/v1/diligence", headers=auth).get_json()["data"]["sensitive_files"]
    assert "Key Employee Compensation.pdf" in [f["name"] for f in sensitive]

    # Nobody can lock others out of the shared demo account
    assert c.put("/api/v1/auth/password", headers=auth, json={"old_password": DEMO_PASSWORD, "new_password": "x" * 12}).status_code == 403
    assert c.delete("/api/v1/auth/account", headers=auth, json={"password": DEMO_PASSWORD}).status_code == 403


def test_spa_is_served_with_client_side_routes(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<div id=root></div>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    monkeypatch.setenv("FRONTEND_DIST", str(dist))
    c = demo_app(tmp_path, monkeypatch).test_client()
    assert c.get("/").data == b"<div id=root></div>"
    assert c.get("/s/some-token").data == b"<div id=root></div>"
    assert c.get("/assets/app.js").data == b"console.log(1)"
    assert c.get("/api/v1/nope").status_code == 404
    assert c.get("/api/v1/health").get_json()["data"]["status"] == "ok"
