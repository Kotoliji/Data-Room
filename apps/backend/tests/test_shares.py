from datetime import datetime, timedelta

from app import db
from app.models import ShareLink
from tests.conftest import register, upload


def folder(client, auth, name, parent_id=None):
    return client.post("/api/v1/folders", headers=auth, json={"name": name, "parent_id": parent_id}).get_json()["data"]


def share(client, auth, **body):
    r = client.post("/api/v1/shares", headers=auth, json=body)
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]


def unlock(client, token, email="investor@fund.com", password=""):
    r = client.post(f"/api/v1/public/shares/{token}/unlock", json={"email": email, "password": password})
    return r, (r.get_json()["data"] or {}).get("access_token")


def test_viewer_sees_only_shared_subtree(client, auth):
    legal = folder(client, auth, "Legal")
    contracts = folder(client, auth, "Contracts", legal["id"])
    hr = folder(client, auth, "HR")
    upload(client, auth, "spa.pdf", folder_id=f"folder:{contracts['id']}")
    secret = upload(client, auth, "salaries.pdf", folder_id=f"folder:{hr['id']}").get_json()["data"]["files"][0]
    upload(client, auth, "root.pdf")

    link = share(client, auth, folder_id=legal["id"])
    _, access = unlock(client, link["token"])
    h = {"X-Share-Access": access}

    root = client.get(f"/api/v1/public/shares/{link['token']}/contents", headers=h).get_json()["data"]
    assert [f["name"] for f in root["folders"]] == ["Contracts"] and root["files"] == []

    sub = client.get(f"/api/v1/public/shares/{link['token']}/contents?folder_id={contracts['id']}", headers=h).get_json()["data"]
    assert [f["name"] for f in sub["files"]] == ["spa.pdf"]
    assert [p["name"] for p in sub["path"]] == ["Contracts"]

    # Folders and files outside the shared subtree are unreachable even by id
    assert client.get(f"/api/v1/public/shares/{link['token']}/contents?folder_id={hr['id']}", headers=h).status_code == 404
    assert client.get(f"/api/v1/public/shares/{link['token']}/files/{secret['id']}", headers=h).status_code == 404


def test_whole_room_share_hides_trash(client, auth):
    fid = upload(client, auth, "old.pdf").get_json()["data"]["files"][0]["id"]
    upload(client, auth, "keep.pdf")
    client.put(f"/api/v1/files/{fid}/move", headers=auth, json={"folder_id": "Trash"})
    link = share(client, auth)
    _, access = unlock(client, link["token"])
    data = client.get(f"/api/v1/public/shares/{link['token']}/contents", headers={"X-Share-Access": access}).get_json()["data"]
    assert [f["name"] for f in data["files"]] == ["keep.pdf"]
    assert client.get(f"/api/v1/public/shares/{link['token']}/files/{fid}", headers={"X-Share-Access": access}).status_code == 404


def test_password_and_email_required(client, auth):
    link = share(client, auth, password="s3cret")
    info = client.get(f"/api/v1/public/shares/{link['token']}").get_json()["data"]
    assert info["requires_password"] is True and info["owner_name"] == "Owner"
    assert unlock(client, link["token"], password="wrong")[0].status_code == 403
    assert unlock(client, link["token"], email="not-an-email", password="s3cret")[0].status_code == 400
    assert unlock(client, link["token"], password="s3cret")[0].status_code == 200


def test_contents_require_access_token(client, auth):
    link = share(client, auth)
    assert client.get(f"/api/v1/public/shares/{link['token']}/contents").status_code == 401
    other = share(client, auth)
    _, access = unlock(client, other["token"])
    r = client.get(f"/api/v1/public/shares/{link['token']}/contents", headers={"X-Share-Access": access})
    assert r.status_code == 401


def test_revoked_and_expired_links(app, client, auth):
    link = share(client, auth, expires_in_days=7)
    _, access = unlock(client, link["token"])
    client.delete(f"/api/v1/shares/{link['id']}", headers=auth)
    assert client.get(f"/api/v1/public/shares/{link['token']}").status_code == 404
    assert client.get(f"/api/v1/public/shares/{link['token']}/contents", headers={"X-Share-Access": access}).status_code == 404

    link2 = share(client, auth, expires_in_days=1)
    with app.app_context():
        db.session.get(ShareLink, link2["id"]).expires_at = datetime.utcnow() - timedelta(minutes=1)
        db.session.commit()
    assert client.get(f"/api/v1/public/shares/{link2['token']}").status_code == 410


def test_view_only_link_blocks_downloads(client, auth):
    pdf = upload(client, auth, "deck.pdf").get_json()["data"]["files"][0]["id"]
    xlsx = upload(client, auth, "model.xlsx", b"PK", "application/vnd.ms-excel").get_json()["data"]["files"][0]["id"]
    link = share(client, auth, allow_download=False)
    _, access = unlock(client, link["token"])
    base = f"/api/v1/public/shares/{link['token']}/files"
    assert client.get(f"{base}/{pdf}?access={access}").status_code == 200
    assert client.get(f"{base}/{pdf}?access={access}&download=1").status_code == 403
    assert client.get(f"{base}/{xlsx}?access={access}").status_code == 403


def test_access_trail_records_viewers(client, auth):
    fid = upload(client, auth, "deck.pdf").get_json()["data"]["files"][0]["id"]
    link = share(client, auth, allow_download=True)
    _, a1 = unlock(client, link["token"], email="a@fund.com")
    _, a2 = unlock(client, link["token"], email="b@fund.com")
    base = f"/api/v1/public/shares/{link['token']}/files/{fid}"
    client.get(f"{base}?access={a1}")
    client.get(f"{base}?access={a2}&download=1")

    trail = client.get(f"/api/v1/shares/{link['id']}/accesses", headers=auth).get_json()["data"]["accesses"]
    assert {(e["viewer_email"], e["action"]) for e in trail} == {
        ("a@fund.com", "opened"), ("b@fund.com", "opened"),
        ("a@fund.com", "viewed"), ("b@fund.com", "downloaded"),
    }
    listed = client.get("/api/v1/shares", headers=auth).get_json()["data"]["shares"][0]
    assert listed["viewer_count"] == 2 and listed["event_count"] == 4


def test_owner_endpoints_are_private(client, auth):
    link = share(client, auth)
    intruder = register(client, "intruder@evil.io")
    assert client.get("/api/v1/shares", headers=intruder).get_json()["data"]["shares"] == []
    assert client.delete(f"/api/v1/shares/{link['id']}", headers=intruder).status_code == 404
    assert client.get(f"/api/v1/shares/{link['id']}/accesses", headers=intruder).status_code == 404
    other_folder = folder(client, auth, "Mine")
    assert client.post("/api/v1/shares", headers=intruder, json={"folder_id": other_folder["id"]}).status_code == 404


def test_permanent_folder_delete_removes_its_links(app, client, auth):
    legal = folder(client, auth, "Legal")
    share(client, auth, folder_id=legal["id"])
    client.delete(f"/api/v1/folders/{legal['id']}", headers=auth)
    client.delete(f"/api/v1/folders/{legal['id']}/permanent", headers=auth)
    with app.app_context():
        assert ShareLink.query.count() == 0
