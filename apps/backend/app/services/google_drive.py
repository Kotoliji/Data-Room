import io
from datetime import datetime, timezone

from flask import current_app
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from app import db
from app.models import User
from app.constants import MAX_FILE_SIZE

GOOGLE_MIME_EXPORT = {
    "application/vnd.google-apps.document": (".pdf", "application/pdf"),
    "application/vnd.google-apps.spreadsheet": (".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "application/vnd.google-apps.presentation": (".pdf", "application/pdf"),
}


def _get_credentials(user: User) -> Credentials | None:
    if not user.google_access_token:
        return None

    creds = Credentials(
        token=user.google_access_token,
        refresh_token=user.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=current_app.config["GOOGLE_CLIENT_ID"],
        client_secret=current_app.config["GOOGLE_CLIENT_SECRET"],
        expiry=user.google_token_expiry,
    )

    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            user.google_access_token = creds.token
            user.google_token_expiry = creds.expiry.replace(tzinfo=timezone.utc) if creds.expiry else None
            db.session.commit()
            current_app.logger.info("Google token refreshed for user %s", user.id)
        except Exception:
            current_app.logger.exception("Failed to refresh Google token for user %s", user.id)
            user.google_access_token = None
            user.google_connected = False
            db.session.commit()
            return None

    return creds


def build_drive_client(user: User):
    creds = _get_credentials(user)
    if not creds:
        return None
    return build("drive", "v3", credentials=creds)


def list_files(user: User, page_size: int = 50, page_token: str | None = None,
               query: str | None = None, parent_id: str | None = None) -> dict | None:
    service = build_drive_client(user)
    if not service:
        return None

    try:
        query_params = {
            "pageSize": page_size,
            "fields": "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink)",
        }
        if page_token:
            query_params["pageToken"] = page_token

        # Build the q filter
        q_parts = ["trashed = false"]
        if parent_id:
            q_parts.append(f"'{parent_id}' in parents")
        if query:
            safe_query = query.replace("\\", "\\\\").replace("'", "\\'")
            q_parts.append(f"name contains '{safe_query}'")
        query_params["q"] = " and ".join(q_parts)

        # Only orderBy when not filtering by parent (Drive API limitation with some queries)
        if not parent_id:
            query_params["orderBy"] = "modifiedTime desc"
        else:
            query_params["orderBy"] = "folder,name"

        results = service.files().list(**query_params).execute()
        return {
            "files": results.get("files", []),
            "next_page_token": results.get("nextPageToken"),
        }
    except Exception:
        current_app.logger.exception("Failed to list Google Drive files for user %s", user.id)
        return None


def download_file(user: User, file_id: str) -> tuple[bytes, str] | None:
    service = build_drive_client(user)
    if not service:
        return None

    try:
        # Get file metadata first
        file_meta = service.files().get(fileId=file_id, fields="name, mimeType").execute()

        # Google Docs/Sheets/Slides need export, regular files use get_media
        mime_type = file_meta.get("mimeType", "")
        if mime_type in GOOGLE_MIME_EXPORT:
            _, export_mime = GOOGLE_MIME_EXPORT[mime_type]
            req = service.files().export_media(fileId=file_id, mimeType=export_mime)
        else:
            req = service.files().get_media(fileId=file_id)

        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, req)
        done = False
        while not done:
            _, done = downloader.next_chunk()
            if buffer.tell() > MAX_FILE_SIZE:
                current_app.logger.warning("File %s exceeds %d MB limit during download", file_id, MAX_FILE_SIZE // (1024 * 1024))
                return None

        return buffer.getvalue(), file_meta.get("name", file_id)
    except Exception:
        current_app.logger.exception("Failed to download file %s for user %s", file_id, user.id)
        return None
