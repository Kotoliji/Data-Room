from app.services import insights
from tests.conftest import register, upload
from tests.test_shares import share, unlock


def setup_room(client, auth):
    legal = client.post("/api/v1/folders", headers=auth, json={"name": "Legal"}).get_json()["data"]
    lease = upload(client, auth, "lease.txt", b"The lease term is five years. Rent is reviewed annually by CPI.",
                   "text/plain", folder_id=f"folder:{legal['id']}").get_json()["data"]["files"][0]
    secret = upload(client, auth, "board.txt", b"The board approved the lease renewal in secret session.",
                    "text/plain").get_json()["data"]["files"][0]
    link = share(client, auth, folder_id=legal["id"])
    return link, lease, secret


def ask(client, link, access, **body):
    return client.post(f"/api/v1/public/shares/{link['token']}/questions", headers={"X-Share-Access": access}, json=body)


def test_question_answer_round_trip(client, auth):
    link, lease, _ = setup_room(client, auth)
    _, access = unlock(client, link["token"], email="buyer@fund.com")
    r = ask(client, link, access, body="How long is the lease term?", file_id=lease["id"], page=1)
    assert r.status_code == 201 and r.get_json()["data"]["status"] == "open"

    inbox = client.get("/api/v1/questions", headers=auth).get_json()["data"]
    q = inbox["questions"][0]
    assert inbox["open_count"] == 1 and q["viewer_email"] == "buyer@fund.com" and q["file_name"] == "lease.txt"

    client.post(f"/api/v1/questions/{q['id']}/answer", headers=auth, json={"answer": "Five years."})
    mine = client.get(f"/api/v1/public/shares/{link['token']}/questions", headers={"X-Share-Access": access}).get_json()["data"]
    assert mine["questions"][0]["answer"] == "Five years." and mine["questions"][0]["status"] == "answered"
    assert client.get("/api/v1/questions", headers=auth).get_json()["data"]["open_count"] == 0


def test_viewers_only_see_their_own_questions(client, auth):
    link, _, _ = setup_room(client, auth)
    _, a = unlock(client, link["token"], email="a@fund.com")
    _, b = unlock(client, link["token"], email="b@fund.com")
    ask(client, link, a, body="Question from A")
    mine = client.get(f"/api/v1/public/shares/{link['token']}/questions", headers={"X-Share-Access": b}).get_json()["data"]
    assert mine["questions"] == []


def test_cannot_ask_about_files_outside_scope(client, auth):
    link, _, secret = setup_room(client, auth)
    _, access = unlock(client, link["token"])
    assert ask(client, link, access, body="What was approved?", file_id=secret["id"]).status_code == 404
    assert ask(client, link, access, body="Page without a file", page=3).status_code == 400
    assert ask(client, link, access, body="x").status_code == 400
    assert client.post(f"/api/v1/public/shares/{link['token']}/questions", json={"body": "no access"}).status_code == 401


def test_other_owners_cannot_answer(client, auth):
    link, _, _ = setup_room(client, auth)
    _, access = unlock(client, link["token"])
    qid = ask(client, link, access, body="Anything?").get_json()["data"]["id"]
    intruder = register(client, "intruder@evil.io")
    assert client.post(f"/api/v1/questions/{qid}/answer", headers=intruder, json={"answer": "hi"}).status_code == 404
    assert client.post(f"/api/v1/questions/{qid}/draft", headers=intruder).status_code == 404


def test_draft_uses_only_documents_in_the_viewers_scope(client, auth):
    link, _, _ = setup_room(client, auth)
    _, access = unlock(client, link["token"])
    qid = ask(client, link, access, body="Was the lease renewal approved, and what is the lease term?").get_json()["data"]["id"]
    draft = client.post(f"/api/v1/questions/{qid}/draft", headers=auth).get_json()["data"]
    assert draft["source"] == "heuristic"
    assert {c["file_name"] for c in draft["citations"]} == {"lease.txt"}  # board.txt is outside the link


def test_claude_draft_citations_are_verified(app, client, auth, monkeypatch):
    link, lease, _ = setup_room(client, auth)
    _, access = unlock(client, link["token"])
    qid = ask(client, link, access, body="What is the lease term?").get_json()["data"]["id"]
    app.config["ANTHROPIC_API_KEY"] = "k"
    monkeypatch.setattr(insights, "_ask_claude", lambda **kw: {"answer": "Five years.", "citations": [
        {"file_id": lease["id"], "quote": "The lease  term is five years."},   # real (whitespace differs)
        {"file_id": lease["id"], "quote": "The lease can be terminated anytime."},  # invented
        {"file_id": 9999, "quote": "Anything"},                                    # unknown file
    ]})
    draft = client.post(f"/api/v1/questions/{qid}/draft", headers=auth).get_json()["data"]
    assert draft["source"] == "claude" and draft["answer"] == "Five years."
    assert [c["quote"] for c in draft["citations"]] == ["The lease  term is five years."]
