"""Document intelligence for due diligence: classification, sensitive-data flags, checklist gaps.

Uses Claude when ANTHROPIC_API_KEY is configured and falls back to keyword heuristics
otherwise, so the feature works (less cleverly) in local dev, tests and demos.
"""
import json
import re
import threading
from pathlib import Path

import anthropic
from flask import Flask, current_app

from app import db
from app.models import DocumentInsight, File
from app.services.text_extract import extract_text

MODEL = "claude-opus-5-5"
CLASSIFY_CHARS = 15_000  # the opening pages identify a document; full text stays searchable

CATEGORIES = ["Corporate", "Financial", "Tax", "Legal", "Commercial", "HR", "IP & Technology", "Real Estate", "Compliance", "Other"]
SENSITIVE_KINDS = ["personal_ids", "compensation", "bank_details", "health", "credentials"]

CHECKLIST = [
    {"id": "articles", "category": "Corporate", "title": "Articles of incorporation & bylaws", "keywords": ["articles of", "bylaws", "incorporation", "charter"]},
    {"id": "cap_table", "category": "Corporate", "title": "Cap table & shareholder register", "keywords": ["cap table", "capitalization", "shareholder", "stock ledger"]},
    {"id": "board_minutes", "category": "Corporate", "title": "Board minutes & resolutions", "keywords": ["minutes", "resolution", "board meeting"]},
    {"id": "audited_fs", "category": "Financial", "title": "Audited financial statements", "keywords": ["audited", "financial statements", "balance sheet", "auditor"]},
    {"id": "management_accounts", "category": "Financial", "title": "Management accounts & budget", "keywords": ["management accounts", "budget", "forecast", "p&l"]},
    {"id": "debt", "category": "Financial", "title": "Loan & debt agreements", "keywords": ["loan", "credit facility", "debt", "promissory"]},
    {"id": "tax_returns", "category": "Tax", "title": "Tax returns (last 3 years)", "keywords": ["tax return", "corporate tax", "vat return", "irs"]},
    {"id": "litigation", "category": "Legal", "title": "Litigation & disputes summary", "keywords": ["litigation", "lawsuit", "dispute", "claim"]},
    {"id": "material_contracts", "category": "Commercial", "title": "Material customer & supplier contracts", "keywords": ["master services", "supply agreement", "customer agreement", "msa"]},
    {"id": "employment", "category": "HR", "title": "Key employment agreements", "keywords": ["employment agreement", "offer letter", "employment contract"]},
    {"id": "esop", "category": "HR", "title": "Equity incentive / option plan", "keywords": ["option plan", "esop", "equity incentive", "stock option"]},
    {"id": "ip_register", "category": "IP & Technology", "title": "IP register (patents, trademarks)", "keywords": ["patent", "trademark", "intellectual property"]},
    {"id": "ip_assignment", "category": "IP & Technology", "title": "IP assignment agreements", "keywords": ["invention assignment", "ip assignment", "assignment of inventions"]},
    {"id": "leases", "category": "Real Estate", "title": "Property leases", "keywords": ["lease", "tenancy", "landlord"]},
    {"id": "privacy", "category": "Compliance", "title": "Data protection / GDPR documentation", "keywords": ["gdpr", "privacy policy", "data protection", "dpa"]},
    {"id": "insurance", "category": "Compliance", "title": "Insurance policies", "keywords": ["insurance", "policy schedule", "coverage"]},
]

_CATEGORY_KEYWORDS = {
    "Corporate": ["bylaws", "articles of", "shareholder", "board of directors", "minutes", "cap table", "incorporation"],
    "Financial": ["balance sheet", "income statement", "revenue", "ebitda", "cash flow", "financial statements", "audit"],
    "Tax": ["tax return", "vat", "withholding", "irs", "tax"],
    "Legal": ["litigation", "court", "plaintiff", "defendant", "legal opinion", "settlement"],
    "Commercial": ["customer", "supplier", "master services", "purchase order", "pricing", "agreement"],
    "HR": ["employee", "employment", "salary", "payroll", "offer letter", "benefits", "option plan"],
    "IP & Technology": ["patent", "trademark", "source code", "intellectual property", "software", "license"],
    "Real Estate": ["lease", "landlord", "tenant", "premises", "property"],
    "Compliance": ["gdpr", "compliance", "anti-bribery", "privacy", "insurance", "regulatory"],
}

_SENSITIVE_PATTERNS = {
    "personal_ids": re.compile(r"\b\d{3}-\d{2}-\d{4}\b|passport no|date of birth|\bssn\b", re.I),
    "compensation": re.compile(r"\bsalary\b|\bbonus\b|compensation|payroll", re.I),
    "bank_details": re.compile(r"\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}\b|\biban\b|account number|routing number", re.I),
    "health": re.compile(r"medical|diagnosis|sick leave|health record", re.I),
    "credentials": re.compile(r"password\s*[:=]|api[_ ]key|secret[_ ]key|BEGIN (?:RSA )?PRIVATE KEY", re.I),
}

_INSIGHT_SCHEMA = {
    "type": "object",
    "properties": {
        "category": {"type": "string", "enum": CATEGORIES},
        "summary": {"type": "string", "description": "One sentence, max 30 words, what the document is and why it matters in diligence"},
        "sensitive": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": SENSITIVE_KINDS},
                    "detail": {"type": "string", "description": "Short description without repeating the sensitive value itself"},
                },
                "required": ["kind", "detail"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["category", "summary", "sensitive"],
    "additionalProperties": False,
}

_REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "status": {"type": "string", "enum": ["covered", "partial", "missing"]},
                    "evidence_file_ids": {"type": "array", "items": {"type": "integer"}},
                    "note": {"type": "string", "description": "One short sentence: what is there or what is missing"},
                },
                "required": ["id", "status", "evidence_file_ids", "note"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["items"],
    "additionalProperties": False,
}


def ai_enabled() -> bool:
    return bool(current_app.config.get("ANTHROPIC_API_KEY"))


def _ask_claude(system: str, content: str, schema: dict, max_tokens: int) -> dict | None:
    """One structured-output call; None on refusal or API failure so callers can fall back."""
    client = anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])
    try:
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": schema}},
            system=system,
            messages=[{"role": "user", "content": content}],
        )
    except anthropic.RateLimitError:
        current_app.logger.warning("Claude rate limited — using heuristics")
        return None
    except anthropic.APIStatusError as e:
        current_app.logger.error("Claude API error %s: %s", e.status_code, e.message)
        return None
    except anthropic.APIConnectionError:
        current_app.logger.error("Claude API unreachable — using heuristics")
        return None

    if response.stop_reason in ("refusal", "max_tokens"):
        current_app.logger.warning("Claude stopped with %s — using heuristics", response.stop_reason)
        return None
    text = next((b.text for b in response.content if b.type == "text"), None)
    return json.loads(text) if text else None


# --------------- Per-document insight ---------------

def heuristic_insight(name: str, text: str) -> dict:
    haystack = f"{name}\n{text[:CLASSIFY_CHARS]}".lower()
    scores = {cat: sum(haystack.count(k) for k in kws) for cat, kws in _CATEGORY_KEYWORDS.items()}
    best = max(scores, key=scores.get)
    first = re.split(r"(?<=[.!?])\s", " ".join(text.split()), maxsplit=1)[0] if text else ""
    sensitive = [{"kind": kind, "detail": "Matched a typical pattern — review before sharing"}
                 for kind, rx in _SENSITIVE_PATTERNS.items() if rx.search(text)]
    return {
        "category": best if scores[best] else "Other",
        "summary": (first[:200] + ("…" if len(first) > 200 else "")) or "No extractable text",
        "sensitive": sensitive,
    }


def claude_insight(name: str, text: str) -> dict | None:
    return _ask_claude(
        system=(
            "You classify documents uploaded to an M&A due diligence data room. "
            "Pick the single best category, write a one-sentence summary for a buyer's analyst, "
            "and list sensitive data a seller should review before sharing (personal IDs, individual "
            "compensation, bank details, health data, credentials). Return an empty list when there is none."
        ),
        content=f"File name: {name}\n\nOpening text (may be truncated):\n{text[:CLASSIFY_CHARS] or '(no extractable text)'}",
        schema=_INSIGHT_SCHEMA,
        max_tokens=2048,
    )


def analyze_file(file_id: int) -> None:
    """Extract text and classify one file, storing the result on its DocumentInsight row."""
    record = db.session.get(File, file_id)
    if not record:
        return
    insight = record.insight or DocumentInsight(file_id=record.id)
    db.session.add(insight)
    try:
        text = extract_text(Path(record.path), record.name) if Path(record.path).exists() else ""
        result = claude_insight(record.original_name, text) if ai_enabled() else None
        insight.source = "claude" if result else "heuristic"
        result = result or heuristic_insight(record.original_name, text)
        insight.text = text
        insight.category = result["category"]
        insight.summary = result["summary"]
        insight.sensitive = json.dumps(result["sensitive"])
        insight.status = "ready"
    except Exception:
        current_app.logger.exception("Analysis failed for file %s", file_id)
        insight.status = "failed"
    db.session.commit()


def queue_analysis(file_ids: list[int]) -> None:
    """Mark files pending and analyze them off the request thread (inline when configured, e.g. tests)."""
    if not file_ids:
        return
    for fid in file_ids:
        if not DocumentInsight.query.filter_by(file_id=fid).first():
            db.session.add(DocumentInsight(file_id=fid, status="pending"))
    db.session.commit()

    app: Flask = current_app._get_current_object()  # type: ignore[attr-defined]
    if not app.config.get("INSIGHTS_ASYNC", True):
        for fid in file_ids:
            analyze_file(fid)
        return

    def run() -> None:
        with app.app_context():
            for fid in file_ids:
                analyze_file(fid)
            db.session.remove()

    threading.Thread(target=run, daemon=True).start()


# --------------- Checklist gap analysis ---------------

def heuristic_review(files: list[File]) -> list[dict]:
    results = []
    for item in CHECKLIST:
        evidence = []
        for f in files:
            insight = f.insight
            haystack = f"{f.original_name}\n{(insight.summary or '') if insight else ''}\n{((insight.text or '')[:CLASSIFY_CHARS]) if insight else ''}".lower()
            if any(k in haystack for k in item["keywords"]):
                evidence.append(f.id)
        results.append({
            "id": item["id"],
            "status": "covered" if evidence else "missing",
            "evidence_file_ids": evidence[:5],
            "note": "Found matching documents" if evidence else "No matching document found",
        })
    return results


def claude_review(files: list[File]) -> list[dict] | None:
    docs = "\n".join(
        f"- id={f.id} | {f.original_name} | {f.insight.category if f.insight else '?'} | {(f.insight.summary if f.insight else '') or ''}"
        for f in files
    )
    items = "\n".join(f"- {i['id']}: [{i['category']}] {i['title']}" for i in CHECKLIST)
    result = _ask_claude(
        system=(
            "You are a buy-side due diligence analyst. Compare the seller's data room index against a standard "
            "checklist. Mark an item covered only when a listed document clearly satisfies it, partial when something "
            "related exists but is incomplete (e.g. one year of three), otherwise missing. Cite evidence by file id."
        ),
        content=f"Data room documents:\n{docs or '(empty)'}\n\nChecklist:\n{items}",
        schema=_REVIEW_SCHEMA,
        max_tokens=8192,
    )
    if not result:
        return None
    by_id = {r["id"]: r for r in result["items"]}
    known = {f.id for f in files}
    # Keep checklist order and drop hallucinated ids
    return [
        {**by_id[i["id"]], "evidence_file_ids": [fid for fid in by_id[i["id"]]["evidence_file_ids"] if fid in known]}
        if i["id"] in by_id else {"id": i["id"], "status": "missing", "evidence_file_ids": [], "note": "Not assessed"}
        for i in CHECKLIST
    ]


# --------------- Q&A answer drafts ---------------

DRAFT_DOC_CHARS = 12_000
_DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string", "description": "Draft reply to the buyer, 2-6 sentences, factual, no speculation"},
        "citations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "file_id": {"type": "integer"},
                    "quote": {"type": "string", "description": "Verbatim sentence copied from that document"},
                },
                "required": ["file_id", "quote"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["answer", "citations"],
    "additionalProperties": False,
}


def _norm(text: str) -> str:
    return " ".join(text.split()).lower()


def _keywords(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-zA-Z]{4,}", text.lower())}


def rank_documents(question: str, files: list[File], pinned_id: int | None, limit: int = 3) -> list[File]:
    """The asked-about file first, then the files sharing the most words with the question."""
    words = _keywords(question)
    with_text = [f for f in files if f.insight and f.insight.text]
    scored = sorted(with_text, key=lambda f: -len(words & _keywords(f.insight.text[:DRAFT_DOC_CHARS])))
    pinned = [f for f in with_text if f.id == pinned_id]
    return (pinned + [f for f in scored if f.id != pinned_id])[:limit]


def _heuristic_draft(question: str, docs: list[File]) -> dict:
    words = _keywords(question)
    citations = []
    for f in docs:
        sentences = [x for x in re.split(r"(?<=[.!?])\s+", " ".join(f.insight.text.split())) if len(x) < 400]
        # The sentence sharing the most words with the question, not merely the first that shares two
        best = max(sentences, key=lambda x: len(words & _keywords(x)), default=None)
        if best and len(words & _keywords(best)) >= 2:
            citations.append({"file_id": f.id, "quote": best})
    answer = ("Thank you for the question. The relevant information is in the documents cited below."
              if citations else "Thank you for the question. We will review it and follow up with the relevant documents.")
    return {"answer": answer, "citations": citations}


def draft_answer(question: str, page: int | None, docs: list[File]) -> dict:
    """Draft a seller-side answer grounded in `docs`; every citation is verified against the source text."""
    result = None
    if ai_enabled() and docs:
        context = "\n\n".join(
            f'<document id="{f.id}" name="{f.original_name}">\n{f.insight.text[:DRAFT_DOC_CHARS]}\n</document>' for f in docs
        )
        result = _ask_claude(
            system=(
                "You help a company selling itself answer buyer questions in an M&A data room. Draft a concise, "
                "professional reply using only the documents provided. If they do not answer the question, say what "
                "information is missing instead of guessing. Cite the sentences you relied on, copied verbatim."
            ),
            content=f"{context}\n\nBuyer question{f' (about page {page})' if page else ''}:\n{question}",
            schema=_DRAFT_SCHEMA,
            max_tokens=4096,
        )
    source = "claude" if result else "heuristic"
    result = result or _heuristic_draft(question, docs)

    texts = {f.id: (f.original_name, _norm(f.insight.text)) for f in docs}
    verified = [
        {"file_id": c["file_id"], "file_name": texts[c["file_id"]][0], "quote": c["quote"]}
        for c in result["citations"]
        if c["file_id"] in texts and _norm(c["quote"]) in texts[c["file_id"]][1]
    ]
    return {"answer": result["answer"], "citations": verified, "source": source}
