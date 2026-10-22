from datetime import datetime, timedelta

import pytest

from app import db
from app.models import User
from app.services import file_service, google_drive


def _utcnow() -> datetime:
    return datetime.utcnow()


@pytest.fixture
def connected(app, auth):
    with app.app_context():
        user = db.session.get(User, 1)
        user.google_connected = True
        user.google_access_token = "access"
        user.google_refresh_token = "refresh"
        user.google_token_expiry = _utcnow() + timedelta(hours=1)
        db.session.commit()
    return auth


def test_import_google_doc_exported_as_pdf(client, connected, monkeypatch):
    calls = []
    monkeypatch.setattr(file_service, "drive_download",
                        lambda user, fid: calls.append(fid) or (b"%PDF-1.4 doc", "Term Sheet"))
    body = {"files": [{"id": "d1", "name": "Term Sheet", "mimeType": "application/vnd.google-apps.document"}]}
    f = client.post("/api/v1/drive/import", headers=connected, json=body).get_json()["data"]["files"][0]
    assert f["original_name"] == "Term Sheet.pdf" and f["mime_type"] == "application/pdf"

    # Re-import reuses the stored bytes instead of downloading again
    client.post("/api/v1/drive/import", headers=connected, json=body)
    assert calls == ["d1"]


def test_failed_download_reported_per_file(client, connected, monkeypatch):
    monkeypatch.setattr(file_service, "drive_download", lambda user, fid: None)
    r = client.post("/api/v1/drive/import", headers=connected, json={"files": [{"id": "x", "name": "x.pdf"}]})
    data = r.get_json()["data"]
    assert data["files"] == [] and data["errors"][0]["name"] == "x.pdf"


def test_import_requires_connected_drive(client, auth):
    assert client.post("/api/v1/drive/import", headers=auth, json={"files": []}).status_code == 403


def test_revoked_refresh_token_disconnects_drive(app, connected, monkeypatch):
    def refresh_fails(self, request):
        raise RuntimeError("invalid_grant")

    monkeypatch.setattr(google_drive.Credentials, "refresh", refresh_fails)
    with app.app_context():
        user = db.session.get(User, 1)
        user.google_token_expiry = _utcnow() - timedelta(hours=1)
        db.session.commit()
        assert google_drive.build_drive_client(user) is None
        assert user.google_connected is False and user.google_access_token is None
