from flask import Blueprint, Response, request, jsonify, current_app

from app import db
from app.models import User, Folder, File
from app.utils import require_auth

folders_bp = Blueprint("folders", __name__)


@folders_bp.route("", methods=["GET"])
@require_auth
def list_folders(user: User) -> tuple[Response, int]:
    parent_id = request.args.get("parent_id")
    fetch_all = request.args.get("all")

    if fetch_all:
        query = Folder.query.filter_by(user_id=user.id)
    elif parent_id:
        try:
            query = Folder.query.filter_by(user_id=user.id, parent_id=int(parent_id))
        except ValueError:
            return jsonify({"data": None, "error": "Invalid parent_id"}), 400
    else:
        query = Folder.query.filter_by(user_id=user.id, parent_id=None)

    folders = query.order_by(Folder.name).all()

    return jsonify({
        "data": {"folders": [f.to_dict() for f in folders]},
        "error": None,
    }), 200


@folders_bp.route("", methods=["POST"])
@require_auth
def create_folder(user: User) -> tuple[Response, int]:
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"data": None, "error": "Name is required"}), 400

    parent_id = data.get("parent_id")
    color = data.get("color", "#3e90f0")

    # Validate parent belongs to user
    if parent_id is not None:
        parent = Folder.query.filter_by(id=parent_id, user_id=user.id).first()
        if not parent:
            return jsonify({"data": None, "error": "Parent folder not found"}), 404

    folder = Folder(name=name, color=color, parent_id=parent_id, user_id=user.id)
    db.session.add(folder)
    db.session.commit()

    current_app.logger.info("Created folder '%s' (id=%d) for user %s", name, folder.id, user.id)
    return jsonify({"data": folder.to_dict(), "error": None}), 201


@folders_bp.route("/<int:folder_id>", methods=["PUT"])
@require_auth
def update_folder(user: User, folder_id: int) -> tuple[Response, int]:
    folder = Folder.query.filter_by(id=folder_id, user_id=user.id).first()
    if not folder:
        return jsonify({"data": None, "error": "Folder not found"}), 404

    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = data["name"].strip()
        if name:
            folder.name = name
    if "color" in data:
        folder.color = data["color"]
    if "parent_id" in data:
        new_parent = data["parent_id"]
        # Prevent moving folder into itself or its descendants
        if new_parent is not None:
            if new_parent == folder_id:
                return jsonify({"data": None, "error": "Cannot move folder into itself"}), 400
            # Verify new parent belongs to the same user
            parent = Folder.query.filter_by(id=new_parent, user_id=user.id).first()
            if not parent:
                return jsonify({"data": None, "error": "Parent folder not found"}), 404
            # Check the new parent isn't a descendant
            check = parent
            while check:
                if check.id == folder_id:
                    return jsonify({"data": None, "error": "Cannot move folder into its own descendant"}), 400
                check = db.session.get(Folder, check.parent_id) if check.parent_id else None
        folder.parent_id = new_parent

    db.session.commit()
    return jsonify({"data": folder.to_dict(), "error": None}), 200


@folders_bp.route("/<int:folder_id>", methods=["DELETE"])
@require_auth
def delete_folder(user: User, folder_id: int) -> tuple[Response, int]:
    folder = Folder.query.filter_by(id=folder_id, user_id=user.id).first()
    if not folder:
        return jsonify({"data": None, "error": "Folder not found"}), 404

    parent_folder_id = folder.parent_id

    # Move files in this folder to Trash
    File.query.filter_by(user_id=user.id, folder_id=f"folder:{folder_id}").update(
        {"folder_id": "Trash"}, synchronize_session=False
    )

    # Move subfolders to parent
    Folder.query.filter_by(user_id=user.id, parent_id=folder_id).update(
        {"parent_id": parent_folder_id}, synchronize_session=False
    )

    db.session.delete(folder)
    db.session.commit()

    current_app.logger.info("Deleted folder %d for user %s", folder_id, user.id)
    return jsonify({"data": {"message": "Folder deleted"}, "error": None}), 200


@folders_bp.route("/<int:folder_id>/path", methods=["GET"])
@require_auth
def folder_path(user: User, folder_id: int) -> tuple[Response, int]:
    path = []
    current = Folder.query.filter_by(id=folder_id, user_id=user.id).first()
    if not current:
        return jsonify({"data": None, "error": "Folder not found"}), 404

    while current:
        path.append(current.to_dict())
        current = db.session.get(Folder, current.parent_id) if current.parent_id else None

    path.reverse()
    return jsonify({"data": {"path": path}, "error": None}), 200
