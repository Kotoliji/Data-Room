import json

from flask import Blueprint, Response, current_app, request, jsonify

from app import db, limiter
from app.models import User, File, DocumentInsight, DiligenceReview
from app.services.insights import CHECKLIST, ai_enabled, claude_review, heuristic_review, queue_analysis
from app.utils import require_auth

diligence_bp = Blueprint("diligence", __name__)


def _room_files(user: User) -> list[File]:
    return File.query.filter(File.user_id == user.id, File.folder_id != "Trash").order_by(File.original_name).all()


def _overview(user: User, files: list[File]) -> dict:
    review = DiligenceReview.query.filter_by(user_id=user.id).order_by(DiligenceReview.created_at.desc()).first()
    results = json.loads(review.result) if review else heuristic_review(files)
    by_id = {r["id"]: r for r in results}
    names = {f.id: f.original_name for f in files}

    checklist = []
    for item in CHECKLIST:
        r = by_id.get(item["id"], {"status": "missing", "evidence_file_ids": [], "note": ""})
        checklist.append({
            "id": item["id"], "category": item["category"], "title": item["title"],
            "status": r["status"], "note": r["note"],
            "evidence": [{"id": fid, "name": names[fid]} for fid in r["evidence_file_ids"] if fid in names],
        })

    categories: dict[str, int] = {}
    sensitive = []
    for f in files:
        insight = f.insight
        if insight and insight.status == "ready":
            categories[insight.category or "Other"] = categories.get(insight.category or "Other", 0) + 1
            flags = json.loads(insight.sensitive or "[]")
            if flags:
                sensitive.append({"id": f.id, "name": f.original_name, "sensitive": flags})

    return {
        "ai_enabled": ai_enabled(),
        "ai_model": current_app.config["ANTHROPIC_MODEL"] if ai_enabled() else None,
        "source": review.source if review else "heuristic",
        "reviewed_at": review.created_at.isoformat() if review else None,
        "checklist": checklist,
        "categories": sorted(({"category": c, "count": n} for c, n in categories.items()), key=lambda c: -c["count"]),
        "sensitive_files": sensitive,
        "total_files": len(files),
        "unanalyzed": sum(1 for f in files if not f.insight),
        "pending": sum(1 for f in files if f.insight and f.insight.status == "pending"),
    }


@diligence_bp.route("/diligence", methods=["GET"])
@require_auth
def diligence_overview(user: User) -> tuple[Response, int]:
    return jsonify({"data": _overview(user, _room_files(user)), "error": None}), 200


@diligence_bp.route("/diligence/review", methods=["POST"])
@require_auth
@limiter.limit("10 per hour")
def run_review(user: User) -> tuple[Response, int]:
    """Re-run the checklist gap analysis (Claude when configured, heuristics otherwise)."""
    files = _room_files(user)
    results = claude_review(files) if ai_enabled() else None
    source = "claude" if results else "heuristic"
    db.session.add(DiligenceReview(user_id=user.id, result=json.dumps(results or heuristic_review(files)), source=source))
    db.session.commit()
    return jsonify({"data": _overview(user, files), "error": None}), 200


@diligence_bp.route("/diligence/analyze", methods=["POST"])
@require_auth
def analyze_missing(user: User) -> tuple[Response, int]:
    """Classify files that predate the feature or failed earlier."""
    ids = [f.id for f in _room_files(user) if not f.insight or f.insight.status == "failed"]
    DocumentInsight.query.filter(DocumentInsight.file_id.in_(ids), DocumentInsight.status == "failed").delete(synchronize_session=False)
    db.session.commit()
    queue_analysis(ids)
    return jsonify({"data": {"queued": len(ids)}, "error": None}), 200


@diligence_bp.route("/files/search", methods=["GET"])
@require_auth
def search_content(user: User) -> tuple[Response, int]:
    """Full-text search inside documents; returns matching file ids with a snippet around the hit."""
    q = request.args.get("q", "").strip()
    if len(q) < 3:
        return jsonify({"data": {"results": []}, "error": None}), 200

    rows = (db.session.query(File, DocumentInsight.text)
            .join(DocumentInsight, DocumentInsight.file_id == File.id)
            .filter(File.user_id == user.id, File.folder_id != "Trash", DocumentInsight.text.ilike(f"%{q}%"))
            .limit(50).all())
    results = []
    for record, text in rows:
        i = text.lower().find(q.lower())
        start = max(0, i - 60)
        snippet = ("…" if start else "") + " ".join(text[start:i + len(q) + 80].split()) + "…"
        results.append({"file_id": record.id, "snippet": snippet})
    return jsonify({"data": {"results": results}, "error": None}), 200
