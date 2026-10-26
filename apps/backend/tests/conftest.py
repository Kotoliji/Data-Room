import io
import os
from urllib.parse import urlsplit

import pytest
from sqlalchemy import text

from app import create_app, db, limiter

PG_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-0123456789")
    # TEST_DATABASE_URL runs the suite against a real Postgres (CI does both)
    monkeypatch.setenv("DATABASE_URL", PG_URL or f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path / "storage"))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")  # tests never call the real API
    monkeypatch.setenv("INSIGHTS_ASYNC", "0")    # analyze inline so assertions see results
    app = create_app()
    limiter.reset()
    yield app
    with app.app_context():
        db.session.remove()
        if PG_URL:  # shared server database: leave it empty for the next test
            db.drop_all()
            db.session.execute(text("DROP TABLE IF EXISTS alembic_version"))
            db.session.commit()
        db.engine.dispose()


@pytest.fixture
def client(app):
    return app.test_client()


def register(client, email: str = "owner@acme.io") -> dict:
    r = client.post("/api/v1/auth/register", json={"name": "Owner", "email": email, "password": "password123"})
    assert r.status_code == 201, r.get_json()
    return {"Authorization": f"Bearer {r.get_json()['data']['token']}"}


@pytest.fixture
def auth(client):
    return register(client)


def upload(client, headers, name: str = "report.pdf", content: bytes = b"%PDF-1.4 test",
           ctype: str = "application/pdf", folder_id: str = "all"):
    return client.post(
        "/api/v1/files/upload", headers=headers, content_type="multipart/form-data",
        data={"files": (io.BytesIO(content), name, ctype), "folder_id": folder_id},
    )


def view(client, headers, file_id: int):
    url = client.get(f"/api/v1/files/{file_id}/token", headers=headers).get_json()["data"]["url"]
    parts = urlsplit(url)
    return client.get(f"{parts.path}?{parts.query}")
