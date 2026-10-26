import pytest

from app.routes import auth as auth_routes
from tests.conftest import register


def login(client, email="owner@acme.io", password="password123"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def bearer(response) -> dict:
    return {"Authorization": f"Bearer {response.get_json()['data']['token']}"}


@pytest.fixture
def reset_links(monkeypatch):
    """Capture reset links instead of sending email."""
    sent: list[str] = []
    monkeypatch.setattr(auth_routes, "send_reset_email", lambda to, link: sent.append(link))
    return sent


def token_from(link: str) -> str:
    return link.split("token=", 1)[1]


# --------------- Register / login ---------------

def test_register_validates_and_normalizes(client):
    assert client.post("/api/v1/auth/register", json={"name": "A", "email": "a@a.io", "password": "short"}).status_code == 400
    assert client.post("/api/v1/auth/register", json={"name": "", "email": "a@a.io", "password": "password123"}).status_code == 400
    r = client.post("/api/v1/auth/register", json={"name": "A", "email": "  Mixed@Case.IO ", "password": "password123"})
    assert r.status_code == 201 and r.get_json()["data"]["email"] == "mixed@case.io"
    again = client.post("/api/v1/auth/register", json={"name": "B", "email": "mixed@case.io", "password": "password123"})
    assert again.status_code == 409


def test_login_does_not_reveal_which_part_was_wrong(client, auth):
    wrong_password = login(client, password="nope-nope")
    unknown_email = login(client, email="ghost@acme.io")
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.get_json()["error"] == unknown_email.get_json()["error"]
    r = login(client)
    assert r.status_code == 200 and client.get("/api/v1/auth/me", headers=bearer(r)).get_json()["data"]["email"] == "owner@acme.io"


def test_tampered_or_missing_token_is_rejected(client, auth):
    assert client.get("/api/v1/auth/me").status_code == 401
    token = auth["Authorization"].split()[1]
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token[:-2]}xx"}).status_code == 401


# --------------- Password reset ---------------

def test_forgot_password_never_reveals_whether_email_exists(client, auth, reset_links):
    known = client.post("/api/v1/auth/forgot-password", json={"email": "owner@acme.io"}).get_json()
    unknown = client.post("/api/v1/auth/forgot-password", json={"email": "ghost@acme.io"}).get_json()
    assert known == unknown
    assert len(reset_links) == 1 and "/reset-password?token=" in reset_links[0]


def test_reset_password_flow_and_single_use(client, auth, reset_links):
    client.post("/api/v1/auth/forgot-password", json={"email": "owner@acme.io"})
    token = token_from(reset_links[0])

    assert client.post("/api/v1/auth/reset-password", json={"token": token, "password": "short"}).status_code == 400
    assert client.post("/api/v1/auth/reset-password", json={"token": token, "password": "brand-new-pass"}).status_code == 200
    assert login(client).status_code == 401
    assert login(client, password="brand-new-pass").status_code == 200

    # The same link must not work twice, even though it has not expired yet
    reuse = client.post("/api/v1/auth/reset-password", json={"token": token, "password": "attacker-pass"})
    assert reuse.status_code == 400
    assert login(client, password="brand-new-pass").status_code == 200


def test_reset_rejects_tampered_and_expired_tokens(client, auth, reset_links, monkeypatch):
    client.post("/api/v1/auth/forgot-password", json={"email": "owner@acme.io"})
    token = token_from(reset_links[0])
    assert client.post("/api/v1/auth/reset-password", json={"token": token + "x", "password": "brand-new-pass"}).status_code == 400

    monkeypatch.setattr(auth_routes, "PASSWORD_RESET_TOKEN_MAX_AGE", -1)
    assert client.post("/api/v1/auth/reset-password", json={"token": token, "password": "brand-new-pass"}).status_code == 400


def test_reset_password_signs_out_every_session(client, auth, reset_links):
    other_device = bearer(login(client))
    client.post("/api/v1/auth/forgot-password", json={"email": "owner@acme.io"})
    client.post("/api/v1/auth/reset-password", json={"token": token_from(reset_links[0]), "password": "brand-new-pass"})
    assert client.get("/api/v1/auth/me", headers=auth).status_code == 401
    assert client.get("/api/v1/auth/me", headers=other_device).status_code == 401


# --------------- Password change ---------------

def test_change_password_keeps_current_session_and_ends_others(client, auth):
    other_device = bearer(login(client))
    wrong = client.put("/api/v1/auth/password", headers=auth, json={"old_password": "nope-nope", "new_password": "brand-new-pass"})
    assert wrong.status_code == 400

    ok = client.put("/api/v1/auth/password", headers=auth, json={"old_password": "password123", "new_password": "brand-new-pass"})
    assert ok.status_code == 200
    assert client.get("/api/v1/auth/me", headers=auth).status_code == 200
    assert client.get("/api/v1/auth/me", headers=other_device).status_code == 401
    assert login(client, password="brand-new-pass").status_code == 200


# --------------- Sessions ---------------

def test_sessions_can_be_listed_and_revoked(client, auth):
    laptop = bearer(login(client))
    sessions = client.get("/api/v1/auth/sessions", headers=auth).get_json()["data"]
    assert len(sessions) == 2

    laptop_id = max(s["id"] for s in sessions)
    assert client.delete(f"/api/v1/auth/sessions/{laptop_id}", headers=auth).status_code == 200
    assert client.get("/api/v1/auth/me", headers=laptop).status_code == 401
    assert client.get("/api/v1/auth/me", headers=auth).status_code == 200


def test_cannot_revoke_someone_elses_session(client, auth):
    intruder = register(client, "intruder@evil.io")
    my_session = client.get("/api/v1/auth/sessions", headers=auth).get_json()["data"][0]["id"]
    assert client.delete(f"/api/v1/auth/sessions/{my_session}", headers=intruder).status_code == 404
    assert client.get("/api/v1/auth/me", headers=auth).status_code == 200


def test_revoke_all_signs_out_everywhere(client, auth):
    laptop = bearer(login(client))
    assert client.delete("/api/v1/auth/sessions", headers=auth).status_code == 200
    assert client.get("/api/v1/auth/me", headers=auth).status_code == 401
    assert client.get("/api/v1/auth/me", headers=laptop).status_code == 401
