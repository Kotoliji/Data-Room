import io
import json
import zipfile
from types import SimpleNamespace

import anthropic
import httpx2

from app.services import insights
from tests.conftest import register, upload


def docx(text: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        paras = "".join(f"<w:p><w:r><w:t>{line}</w:t></w:r></w:p>" for line in text.split("\n"))
        zf.writestr("word/document.xml", f'<w:document xmlns:w="w"><w:body>{paras}</w:body></w:document>')
    return buf.getvalue()


def files(client, auth):
    return {f["original_name"]: f for f in client.get("/api/v1/files", headers=auth).get_json()["data"]["files"]}


def test_upload_is_classified_and_flagged(client, auth):
    upload(client, auth, "payroll.docx", docx("Employee payroll 2025\nJane Roe salary 120000\nIBAN DE89 3704 0044 0532 0130 00"),
           "application/octet-stream")
    insight = files(client, auth)["payroll.docx"]["insight"]
    assert insight["status"] == "ready" and insight["source"] == "heuristic"
    assert insight["category"] == "HR"
    assert {s["kind"] for s in insight["sensitive"]} >= {"compensation", "bank_details"}


def test_content_search_finds_text_inside_documents(client, auth):
    upload(client, auth, "a.txt", b"The landlord may terminate the lease with 90 days notice.", "text/plain")
    upload(client, auth, "b.txt", b"Unrelated memo", "text/plain")
    results = client.get("/api/v1/files/search?q=terminate", headers=auth).get_json()["data"]["results"]
    assert len(results) == 1 and "terminate the lease" in results[0]["snippet"]

    intruder = register(client, "intruder@evil.io")
    assert client.get("/api/v1/files/search?q=terminate", headers=intruder).get_json()["data"]["results"] == []


def test_checklist_heuristic_and_sensitive_overview(client, auth):
    upload(client, auth, "Audited financial statements 2025.txt", b"Balance sheet audited by KPMG", "text/plain")
    upload(client, auth, "Office lease.txt", b"Lease between landlord and tenant", "text/plain")
    data = client.get("/api/v1/diligence", headers=auth).get_json()["data"]
    status = {i["id"]: i["status"] for i in data["checklist"]}
    assert status["audited_fs"] == "covered" and status["leases"] == "covered" and status["tax_returns"] == "missing"
    assert data["ai_enabled"] is False and data["total_files"] == 2 and data["unanalyzed"] == 0


def test_claude_review_is_validated_against_real_files(app, client, auth, monkeypatch):
    fid = upload(client, auth, "cap table.txt", b"Shareholders", "text/plain").get_json()["data"]["files"][0]["id"]
    app.config["ANTHROPIC_API_KEY"] = "test-key"
    monkeypatch.setattr(insights, "_ask_claude", lambda **kw: {"items": [
        {"id": "cap_table", "status": "covered", "evidence_file_ids": [fid, 9999], "note": "Cap table present"},
    ]})
    data = client.post("/api/v1/diligence/review", headers=auth).get_json()["data"]
    items = {i["id"]: i for i in data["checklist"]}
    assert data["source"] == "claude"
    assert items["cap_table"]["evidence"] == [{"id": fid, "name": "cap table.txt"}]  # hallucinated id dropped
    assert items["leases"]["status"] == "missing"


def test_share_preview_warns_about_sensitive_files(client, auth):
    folder = client.post("/api/v1/folders", headers=auth, json={"name": "HR"}).get_json()["data"]
    upload(client, auth, "salaries.txt", b"Bonus and salary for each employee", "text/plain", folder_id=f"folder:{folder['id']}")
    upload(client, auth, "deck.txt", b"Company overview", "text/plain")
    whole = client.get("/api/v1/shares/preview", headers=auth).get_json()["data"]
    assert whole["total"] == 2 and [f["name"] for f in whole["flagged"]] == ["salaries.txt"]


# --------------- Claude call handling (SDK client mocked) ---------------

def fake_client(monkeypatch, *, response=None, error=None):
    captured = {}

    def create(**kwargs):
        captured.update(kwargs)
        if error:
            raise error
        return response

    client = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(create=create)))
    monkeypatch.setattr(insights.anthropic, "Anthropic", lambda api_key: client)
    return captured


def test_claude_insight_request_shape_and_parsing(app, monkeypatch):
    payload = {"category": "Legal", "summary": "Settlement agreement", "sensitive": []}
    captured = fake_client(monkeypatch, response=SimpleNamespace(stop_reason="end_turn", content=[
        SimpleNamespace(type="thinking", thinking=""),
        SimpleNamespace(type="text", text=json.dumps(payload)),
    ]))
    with app.app_context():
        app.config["ANTHROPIC_API_KEY"] = "k"
        assert insights.claude_insight("settlement.pdf", "text") == payload
    assert captured["model"] == "claude-opus-5-5" and captured["fallbacks"] == "default"
    assert captured["output_config"]["format"]["type"] == "json_schema"


def test_refusal_and_api_errors_fall_back_to_heuristics(app, monkeypatch):
    with app.app_context():
        app.config["ANTHROPIC_API_KEY"] = "k"
        fake_client(monkeypatch, response=SimpleNamespace(stop_reason="refusal", content=[]))
        assert insights.claude_insight("x.pdf", "text") is None

        request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
        overloaded = anthropic.InternalServerError("overloaded", response=httpx2.Response(529, request=request), body=None)
        fake_client(monkeypatch, error=overloaded)
        assert insights.claude_insight("x.pdf", "text") is None
