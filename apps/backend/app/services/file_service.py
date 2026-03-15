import uuid
from pathlib import Path

from flask import current_app
from werkzeug.utils import secure_filename

from app import db
from app.models import User, File
from app.services.google_drive import download_file as drive_download, GOOGLE_MIME_EXPORT
from app.constants import MAX_FILE_SIZE


def storage_dir(user_id: int) -> Path:
    base = Path(current_app.root_path).parent / "storage" / str(user_id)
    base.mkdir(parents=True, exist_ok=True)
    return base


def _deduplicate_name(name: str, user_id: int, folder_id: str) -> str:
    """Append (1), (2), etc. if a file with the same name already exists."""
    existing = File.query.filter_by(user_id=user_id, folder_id=folder_id, original_name=name).first()
    if not existing:
        return name

    stem = name
    ext = ""
    if "." in name:
        parts = name.rsplit(".", 1)
        stem, ext = parts[0], f".{parts[1]}"

    counter = 1
    while counter <= 100:
        candidate = f"{stem} ({counter}){ext}"
        if not File.query.filter_by(user_id=user_id, folder_id=folder_id, original_name=candidate).first():
            return candidate
        counter += 1
    return f"{stem} ({uuid.uuid4().hex[:8]}){ext}"


def import_from_drive(user: User, drive_file_id: str, drive_file_name: str,
                      drive_mime_type: str, drive_size: int,
                      folder_id: str = "all") -> File | None:
    """Download a file from Google Drive and save it locally."""

    # Check if already imported
    existing = File.query.filter_by(user_id=user.id, drive_file_id=drive_file_id).first()
    if existing:
        current_app.logger.info("File %s already imported as file %d", drive_file_id, existing.id)
        return existing

    # Reject files that exceed the size limit (Google Docs have size=0, checked after download)
    if drive_size > MAX_FILE_SIZE:
        current_app.logger.warning("Drive file %s too large: %d bytes", drive_file_id, drive_size)
        return None

    result = drive_download(user, drive_file_id)
    if not result:
        current_app.logger.error("Failed to download Drive file %s for user %s", drive_file_id, user.id)
        return None

    file_bytes, original_name = result

    # For Google Docs/Sheets/Slides, adjust name and mime_type
    mime_type = drive_mime_type
    if drive_mime_type in GOOGLE_MIME_EXPORT:
        ext, mime_type = GOOGLE_MIME_EXPORT[drive_mime_type]
        if not original_name.endswith(ext):
            original_name = f"{original_name}{ext}"

    display_name = _deduplicate_name(original_name, user.id, folder_id)
    safe_name = secure_filename(original_name) or "unnamed"
    unique_name = f"{uuid.uuid4().hex}_{safe_name}"
    storage = storage_dir(user.id)
    file_path = storage / unique_name

    file_path.write_bytes(file_bytes)

    record = File(
        name=safe_name,
        original_name=display_name,
        mime_type=mime_type,
        size=len(file_bytes) if len(file_bytes) > 0 else drive_size,
        path=str(file_path),
        drive_file_id=drive_file_id,
        folder_id=folder_id,
        user_id=user.id,
        status="imported",
    )
    db.session.add(record)
    db.session.flush()

    current_app.logger.info("Imported Drive file '%s' as file %d for user %s", display_name, record.id, user.id)
    return record
