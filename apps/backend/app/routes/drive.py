from flask import Blueprint, Response, request, jsonify, current_app

from app import db
from app.models import User
from app.services.google_drive import list_files as drive_list_files
from app.services.file_service import import_from_drive
from app.services.activity_service import log_activity
from app.utils import require_auth

drive_bp = Blueprint("drive", __name__)


@drive_bp.route("/files", methods=["GET"])
@require_auth
def list_drive_files(user: User) -> tuple[Response, int]:
    if not user.google_connected:
        return jsonify({"data": None, "error": "Google Drive not connected"}), 403

    page_token = request.args.get("page_token")
    query = request.args.get("q", "")
    parent_id = request.args.get("parent_id", "")

    result = drive_list_files(user, page_size=50, page_token=page_token or None,
                              query=query or None, parent_id=parent_id or None)
    if result is None:
        return jsonify({"data": None, "error": "Failed to fetch Google Drive files. Please reconnect."}), 503

    return jsonify({"data": result, "error": None}), 200


@drive_bp.route("/import", methods=["POST"])
@require_auth
def import_drive_files(user: User) -> tuple[Response, int]:
    if not user.google_connected:
        return jsonify({"data": None, "error": "Google Drive not connected"}), 403

    data = request.get_json()
    if not data or not isinstance(data.get("files"), list):
        return jsonify({"data": None, "error": "files array is required"}), 400

    files_to_import = data["files"]
    folder_id = data.get("folder_id", "all")

    if len(files_to_import) > 20:
        return jsonify({"data": None, "error": "Maximum 20 files per import"}), 400

    imported = []
    errors = []

    for f in files_to_import:
        file_id = f.get("id")
        file_name = f.get("name", "unknown")
        mime_type = f.get("mimeType", "application/octet-stream")
        size = int(f.get("size", 0))

        if not file_id:
            errors.append({"name": file_name, "error": "Missing file ID"})
            continue

        record = import_from_drive(user, file_id, file_name, mime_type, size, folder_id)
        if record:
            log_activity(user.id, "imported", record.original_name, folder_id=record.folder_id, details="from Google Drive")
            imported.append(record.to_dict())
        else:
            errors.append({"name": file_name, "error": "Download failed"})

    db.session.commit()

    current_app.logger.info(
        "Drive import for user %s: %d imported, %d errors",
        user.id, len(imported), len(errors),
    )

    return jsonify({
        "data": {"files": imported, "errors": errors},
        "error": None,
    }), 200
