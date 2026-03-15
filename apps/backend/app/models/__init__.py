from datetime import datetime, timezone

from werkzeug.security import generate_password_hash, check_password_hash

from app import db


class User(db.Model):
    __tablename__ = "users"

    id: int = db.Column(db.Integer, primary_key=True)
    name: str = db.Column(db.String(120), nullable=False)
    email: str = db.Column(db.String(120), unique=True, nullable=False)
    password_hash: str = db.Column(db.String(256), nullable=False)
    location: str | None = db.Column(db.String(200), nullable=True)
    avatar_path: str | None = db.Column(db.String(500), nullable=True)
    google_access_token: str | None = db.Column(db.Text, nullable=True)
    google_refresh_token: str | None = db.Column(db.Text, nullable=True)
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
