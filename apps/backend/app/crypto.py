import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from flask import current_app
from sqlalchemy.types import Text, TypeDecorator

PREFIX = "fernet:"


def _fernet() -> Fernet:
    """Derive a Fernet key from SECRET_KEY (or a dedicated TOKEN_ENCRYPTION_KEY)."""
    secret = current_app.config.get("TOKEN_ENCRYPTION_KEY") or current_app.config["SECRET_KEY"]
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


class EncryptedText(TypeDecorator):
    """Text column encrypted at rest. Legacy plaintext values are read as-is."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        return PREFIX + _fernet().encrypt(value.encode()).decode()

    def process_result_value(self, value: str | None, dialect) -> str | None:
        if value is None or not value.startswith(PREFIX):
            return value
        try:
            return _fernet().decrypt(value[len(PREFIX):].encode()).decode()
        except InvalidToken:
            # Key rotated — token is unusable, user must reconnect Google Drive
            current_app.logger.warning("Could not decrypt stored token — key changed?")
            return None
