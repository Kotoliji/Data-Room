from pathlib import Path

from app import db
from app.models import File, Folder
from tests.conftest import upload


def make_tree(client, auth):
    root = client.post("/api/v1/folders", headers=auth, json={"name": "Legal"}).get_json()["data"]
    child = client.post("/api/v1/folders", headers=auth,
                        json={"name": "Contracts", "parent_id": root["id"]}).get_json()["data"]
    fid = upload(client, auth, folder_id=f"folder:{child['id']}").get_json()["data"]["files"][0]["id"]
    return root, child, fid


def test_trash_and_restore_nested_tree(app, client, auth):
    root, child, fid = make_tree(client, auth)
    assert client.delete(f"/api/v1/folders/{root['id']}", headers=auth).status_code == 200
    with app.app_context():
        assert db.session.get(Folder, child["id"]).status == "trashed"
        assert db.session.get(File, fid).folder_id == "Trash"

    assert client.post(f"/api/v1/folders/{root['id']}/restore", headers=auth).status_code == 200
    with app.app_context():
        assert db.session.get(Folder, child["id"]).status == "active"
        assert db.session.get(File, fid).folder_id == f"folder:{child['id']}"


def test_permanent_delete_leaves_no_orphans(app, client, auth):
    root, _, fid = make_tree(client, auth)
    with app.app_context():
        path = Path(db.session.get(File, fid).path)
    client.delete(f"/api/v1/folders/{root['id']}", headers=auth)
    assert client.delete(f"/api/v1/folders/{root['id']}/permanent", headers=auth).status_code == 200
    with app.app_context():
        assert db.session.get(File, fid) is None
        assert Folder.query.count() == 0
    assert not path.exists()


def test_cannot_move_folder_into_descendant(client, auth):
    root, child, _ = make_tree(client, auth)
    r = client.put(f"/api/v1/folders/{root['id']}", headers=auth, json={"parent_id": child["id"]})
    assert r.status_code == 400


def test_breadcrumb_path(client, auth):
    _, child, _ = make_tree(client, auth)
    path = client.get(f"/api/v1/folders/{child['id']}/path", headers=auth).get_json()["data"]["path"]
    assert [p["name"] for p in path] == ["Legal", "Contracts"]
