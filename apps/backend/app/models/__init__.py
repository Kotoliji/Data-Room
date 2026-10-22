from datetime import datetime, timezone

from werkzeug.security import generate_password_hash, check_password_hash

from app import db
from app.crypto import EncryptedText


class User(db.Model):
    __tablename__ = "users"

    id: int = db.Column(db.Integer, primary_key=True)
    name: str = db.Column(db.String(120), nullable=False)
    email: str = db.Column(db.String(120), unique=True, nullable=False)
    password_hash: str = db.Column(db.String(256), nullable=False)
    location: str | None = db.Column(db.String(200), nullable=True)
    avatar_path: str | None = db.Column(db.String(500), nullable=True)
    google_access_token: str | None = db.Column(EncryptedText, nullable=True)
    google_refresh_token: str | None = db.Column(EncryptedText, nullable=True)
    google_token_expiry: datetime | None = db.Column(db.DateTime, nullable=True)
    google_connected: bool = db.Column(db.Boolean, default=False)
    created_at: datetime = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class Session(db.Model):
    __tablename__ = "sessions"

    id: int = db.Column(db.Integer, primary_key=True)
    user_id: int = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    device: str = db.Column(db.String(200), nullable=False)
    ip: str = db.Column(db.String(45), nullable=False)
    created_at: datetime = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )
    is_active: bool = db.Column(db.Boolean, default=True)

    user = db.relationship("User", backref="sessions")


class File(db.Model):
    __tablename__ = "files"

    id: int = db.Column(db.Integer, primary_key=True)
    name: str = db.Column(db.String(255), nullable=False)
    original_name: str = db.Column(db.String(255), nullable=False)
    mime_type: str | None = db.Column(db.String(100))
    size: int = db.Column(db.Integer, default=0)
    path: str = db.Column(db.String(512), nullable=False)
    drive_file_id: str | None = db.Column(db.String(200), nullable=True)
    folder_id: str = db.Column(db.String(100), default="all")
    original_folder_id: str | None = db.Column(db.String(100), nullable=True)
    user_id: int = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status: str = db.Column(db.String(20), default="uploaded")
    created_at: datetime = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    user = db.relationship("User", backref="files")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "original_name": self.original_name,
            "mime_type": self.mime_type,
            "size": self.size,
            "folder_id": self.folder_id,
            "drive_file_id": self.drive_file_id,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }


class Folder(db.Model):
    __tablename__ = "folders"

    id: int = db.Column(db.Integer, primary_key=True)
    name: str = db.Column(db.String(255), nullable=False)
    color: str = db.Column(db.String(20), default="#3e90f0")
    parent_id: int | None = db.Column(db.Integer, db.ForeignKey("folders.id"), nullable=True)
    user_id: int = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status: str = db.Column(db.String(20), default="active", nullable=False)
    created_at: datetime = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    user = db.relationship("User", backref="folders")
    children = db.relationship("Folder", backref=db.backref("parent", remote_side="Folder.id"), lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "parent_id": self.parent_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ActivityLog(db.Model):
    __tablename__ = "activity_logs"

    id: int = db.Column(db.Integer, primary_key=True)
    user_id: int = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    action: str = db.Column(db.String(50), nullable=False)
    file_name: str = db.Column(db.String(255), nullable=False)
    folder_id: str = db.Column(db.String(100), default="all")
    details: str | None = db.Column(db.Text, nullable=True)
    created_at: datetime = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    user = db.relationship("User", backref="activity_logs")


class ShareLink(db.Model):
    """External access link to the whole Data Room (folder_id=None) or a folder subtree."""

    __tablename__ = "share_links"

    id: int = db.Column(db.Integer, primary_key=True)
    token: str = db.Column(db.String(64), unique=True, nullable=False, index=True)
    user_id: int = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    folder_id: int | None = db.Column(db.Integer, db.ForeignKey("folders.id", ondelete="CASCADE"), nullable=True)
    name: str = db.Column(db.String(120), nullable=False)
    password_hash: str | None = db.Column(db.String(256), nullable=True)
    expires_at: datetime | None = db.Column(db.DateTime, nullable=True)
    allow_download: bool = db.Column(db.Boolean, default=False, nullable=False)
    revoked: bool = db.Column(db.Boolean, default=False, nullable=False)
    created_at: datetime = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    folder = db.relationship("Folder")
    accesses = db.relationship("ShareAccess", backref="link", cascade="all, delete-orphan",
                               lazy="dynamic", order_by="ShareAccess.created_at.desc()")

    def set_password(self, password: str | None) -> None:
        self.password_hash = generate_password_hash(password) if password else None

    def check_password(self, password: str) -> bool:
        return self.password_hash is None or check_password_hash(self.password_hash, password)

    def is_expired(self) -> bool:
        return self.expires_at is not None and self.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None)

    def to_dict(self) -> dict:
        last = self.accesses.first()
        return {
            "id": self.id,
            "token": self.token,
            "name": self.name,
            "folder_id": self.folder_id,
            "folder_name": self.folder.name if self.folder else None,
            "has_password": self.password_hash is not None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "allow_download": self.allow_download,
            "revoked": self.revoked,
            "expired": self.is_expired(),
            "created_at": self.created_at.isoformat(),
            "viewer_count": self.accesses.with_entities(ShareAccess.viewer_email).distinct().count(),
            "event_count": self.accesses.count(),
            "last_access_at": last.created_at.isoformat() if last else None,
        }


class ShareAccess(db.Model):
    """Audit trail: who opened a share link and which documents they viewed or downloaded."""

    __tablename__ = "share_accesses"

    id: int = db.Column(db.Integer, primary_key=True)
    link_id: int = db.Column(db.Integer, db.ForeignKey("share_links.id", ondelete="CASCADE"), nullable=False, index=True)
    viewer_email: str = db.Column(db.String(120), nullable=False)
    action: str = db.Column(db.String(20), nullable=False)  # opened | viewed | downloaded
    file_id: int | None = db.Column(db.Integer, nullable=True)  # no FK: the trail outlives deleted files
    file_name: str | None = db.Column(db.String(255), nullable=True)
    ip: str = db.Column(db.String(45), nullable=False)
    created_at: datetime = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "viewer_email": self.viewer_email,
            "action": self.action,
            "file_name": self.file_name,
            "ip": self.ip,
            "created_at": self.created_at.isoformat(),
        }
