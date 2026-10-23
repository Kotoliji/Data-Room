from pathlib import Path

from app import db
from app.models import File
from tests.conftest import register, upload, view


def test_upload_and_view_pdf_inline(client, auth):
    r = upload(client, auth)
    assert r.status_code == 200
    v = view(client, auth, r.get_json()["data"]["files"][0]["id"])
    assert v.status_code == 200 and "inline" in v.headers["Content-Disposition"]


def test_duplicate_upload_names_are_numbered(client, auth):
    names = [upload(client, auth).get_json()["data"]["files"][0]["original_name"] for _ in range(3)]
    assert names == ["report.pdf", "report (1).pdf", "report (2).pdf"]


def test_disallowed_extension_is_skipped(client, auth):
    data = upload(client, auth, "run.exe", b"MZ", "application/octet-stream").get_json()["data"]
    assert data["files"] == [] and data["skipped"][0]["name"] == "run.exe"


def test_rename_conflict_returns_409(client, auth):
    upload(client, auth, "a.pdf")
    fid = upload(client, auth, "b.pdf").get_json()["data"]["files"][0]["id"]
    assert client.put(f"/api/v1/files/{fid}/rename", headers=auth, json={"name": "a.pdf"}).status_code == 409
    r = client.put(f"/api/v1/files/{fid}/rename", headers=auth, json={"name": "c.pdf"})
    assert r.status_code == 200 and r.get_json()["data"]["original_name"] == "c.pdf"


def test_delete_removes_bytes_from_disk(app, client, auth):
    fid = upload(client, auth).get_json()["data"]["files"][0]["id"]
    with app.app_context():
        path = Path(db.session.get(File, fid).path)
    assert path.exists()
    assert client.delete(f"/api/v1/files/{fid}", headers=auth).status_code == 200
    assert not path.exists()


def test_other_users_cannot_touch_my_files(client, auth):
    fid = upload(client, auth).get_json()["data"]["files"][0]["id"]
    intruder = register(client, "intruder@evil.io")
    assert client.get(f"/api/v1/files/{fid}/token", headers=intruder).status_code == 404
    assert client.delete(f"/api/v1/files/{fid}", headers=intruder).status_code == 404
    assert client.get("/api/v1/files", headers=intruder).get_json()["data"]["files"] == []


def test_cannot_upload_into_foreign_folder(client, auth):
    folder = client.post("/api/v1/folders", headers=auth, json={"name": "Mine"}).get_json()["data"]
    intruder = register(client, "intruder@evil.io")
    assert upload(client, intruder, folder_id=f"folder:{folder['id']}").status_code == 404


def test_requires_auth(client):
    assert client.get("/api/v1/files").status_code == 401
