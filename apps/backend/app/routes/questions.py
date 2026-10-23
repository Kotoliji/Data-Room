from datetime import datetime, timezone

from flask import Blueprint, Response, request, jsonify

from app import db, limiter
from app.models import User, File, Question
from app.routes.shares import _file_in_scope
from app.services.insights import draft_answer, rank_documents
from app.utils import require_auth

questions_bp = Blueprint("questions", __name__)


def _owned(user: User, question_id: int) -> Question | None:
    return Question.query.filter_by(id=question_id, user_id=user.id).first()


@questions_bp.route("", methods=["GET"])
@require_auth
def list_questions(user: User) -> tuple[Response, int]:
    status = request.args.get("status", "open")
    query = Question.query.filter_by(user_id=user.id)
    if status == "open":
        query = query.filter(Question.answer.is_(None))
    elif status == "answered":
        query = query.filter(Question.answer.isnot(None))
    questions = query.order_by(Question.created_at.desc()).limit(200).all()
    open_count = Question.query.filter_by(user_id=user.id).filter(Question.answer.is_(None)).count()
    return jsonify({"data": {
        "questions": [q.to_dict(for_owner=True) for q in questions],
        "open_count": open_count,
    }, "error": None}), 200


@questions_bp.route("/<int:question_id>/answer", methods=["POST"])
@require_auth
def answer_question(user: User, question_id: int) -> tuple[Response, int]:
    question = _owned(user, question_id)
    if not question:
        return jsonify({"data": None, "error": "Question not found"}), 404
    answer = str((request.get_json(silent=True) or {}).get("answer", "")).strip()
    if not answer:
        return jsonify({"data": None, "error": "Answer is required"}), 400
    question.answer = answer[:5000]
    question.answered_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"data": question.to_dict(for_owner=True), "error": None}), 200


@questions_bp.route("/<int:question_id>/draft", methods=["POST"])
@require_auth
@limiter.limit("30 per hour")
def draft(user: User, question_id: int) -> tuple[Response, int]:
    """Suggest an answer grounded only in documents this viewer's link can already see."""
    question = _owned(user, question_id)
    if not question:
        return jsonify({"data": None, "error": "Question not found"}), 404
    files = File.query.filter(File.user_id == user.id, File.folder_id != "Trash").all()
    visible = [f for f in files if _file_in_scope(question.link, f)]
    docs = rank_documents(question.body, visible, question.file_id)
    return jsonify({"data": draft_answer(question.body, question.page, docs), "error": None}), 200
