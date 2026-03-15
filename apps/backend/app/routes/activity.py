from flask import Blueprint, Response, request, jsonify

from app import db
from app.models import User, ActivityLog
from app.utils import require_auth

activity_bp = Blueprint("activity", __name__)


@activity_bp.route("", methods=["GET"])
@require_auth
def list_activity(user: User) -> tuple[Response, int]:
    folder_id = request.args.get("folder_id")

    query = ActivityLog.query.filter_by(user_id=user.id)

    if folder_id and folder_id != "All documents":
        query = query.filter_by(folder_id=folder_id)
    elif folder_id == "All documents":
        query = query.filter(ActivityLog.folder_id != "Trash")

    logs = (
        query
        .order_by(ActivityLog.created_at.desc())
        .limit(100)
        .all()
    )

    return jsonify({
        "data": {
            "activity": [
                {
                    "id": log.id,
                    "action": log.action,
                    "file_name": log.file_name,
                    "folder_id": log.folder_id,
                    "details": log.details,
                    "created_at": log.created_at.isoformat(),
                }
                for log in logs
            ]
        },
        "error": None,
    }), 200


@activity_bp.route("", methods=["DELETE"])
@require_auth
def clear_activity(user: User) -> tuple[Response, int]:
    ActivityLog.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    db.session.commit()

    return jsonify({"data": {"message": "Activity cleared"}, "error": None}), 200
