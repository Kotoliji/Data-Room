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
    status = request.args.get("status", "active")

    if status not in ("active", "trashed"):
        return jsonify({"data": None, "error": "Invalid status filter"}), 400

    if status == "trashed":
        # Show all trashed folders regardless of parent
        query = Folder.query.filter_by(user_id=user.id, status="trashed")
    elif fetch_all:
        query = Folder.query.filter_by(user_id=user.id, status=status)
    elif parent_id:
        try:
            query = Folder.query.filter_by(user_id=user.id, parent_id=int(parent_id), status=status)
        except ValueError:
            return jsonify({"data": None, "error": "Invalid parent_id"}), 400
    else:
        query = Folder.query.filter_by(user_id=user.id, parent_id=None, status=status)

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
    """Soft delete: move folder to trash."""
    folder = Folder.query.filter_by(id=folder_id, user_id=user.id).first()
    if not folder:
        return jsonify({"data": None, "error": "Folder not found"}), 404

    folder.status = "trashed"

    def trash_files_in_folder(fid: int) -> None:
        """Move files to Trash, saving original_folder_id for restore."""
        folder_key = f"folder:{fid}"
        files = File.query.filter_by(user_id=user.id, folder_id=folder_key).all()
        for f in files:
            f.original_folder_id = f.folder_id
            f.folder_id = "Trash"

    def trash_recursive(parent_id: int) -> None:
        children = Folder.query.filter_by(parent_id=parent_id, user_id=user.id, status="active").all()
        for child in children:
            child.status = "trashed"
            trash_files_in_folder(child.id)
            trash_recursive(child.id)

    trash_files_in_folder(folder_id)
    trash_recursive(folder_id)

    db.session.commit()

    current_app.logger.info("Trashed folder %d for user %s", folder_id, user.id)
    return jsonify({"data": {"message": "Folder moved to trash"}, "error": None}), 200


@folders_bp.route("/<int:folder_id>/permanent", methods=["DELETE"])
@require_auth
def delete_folder_permanent(user: User, folder_id: int) -> tuple[Response, int]:
    """Permanent delete: remove folder from DB entirely."""
    folder = Folder.query.filter_by(id=folder_id, user_id=user.id).first()
    if not folder:
        return jsonify({"data": None, "error": "Folder not found"}), 404

    def delete_recursive(fid: int) -> None:
        children = Folder.query.filter_by(parent_id=fid, user_id=user.id).all()
        for child in children:
            delete_recursive(child.id)
            db.session.delete(child)

    delete_recursive(folder_id)
    db.session.delete(folder)
    db.session.commit()

    current_app.logger.info("Permanently deleted folder %d for user %s", folder_id, user.id)
    return jsonify({"data": {"message": "Folder permanently deleted"}, "error": None}), 200


@folders_bp.route("/<int:folder_id>/restore", methods=["POST"])
@require_auth
def restore_folder(user: User, folder_id: int) -> tuple[Response, int]:
    """Restore a trashed folder back to active."""
    folder = Folder.query.filter_by(id=folder_id, user_id=user.id).first()
    if not folder:
        return jsonify({"data": None, "error": "Folder not found"}), 404

    if folder.status != "trashed":
        return jsonify({"data": None, "error": "Folder is not in trash"}), 400

    # If parent was also trashed or deleted, move to root
    if folder.parent_id:
        parent = Folder.query.filter_by(id=folder.parent_id, user_id=user.id, status="active").first()
        if not parent:
            folder.parent_id = None

    folder.status = "active"

    # Restore files that had original_folder_id pointing to this folder
    def restore_files_in_folder(fid: int) -> None:
        folder_key = f"folder:{fid}"
        files = File.query.filter_by(
            user_id=user.id, folder_id="Trash", original_folder_id=folder_key
        ).all()
        for f in files:
            f.folder_id = f.original_folder_id
            f.original_folder_id = None

    def restore_recursive(parent_id: int) -> None:
        children = Folder.query.filter_by(parent_id=parent_id, user_id=user.id, status="trashed").all()
        for child in children:
            child.status = "active"
            restore_files_in_folder(child.id)
            restore_recursive(child.id)

    restore_files_in_folder(folder_id)
    restore_recursive(folder_id)

    db.session.commit()

    current_app.logger.info("Restored folder %d for user %s", folder_id, user.id)
    return jsonify({"data": folder.to_dict(), "error": None}), 200


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
