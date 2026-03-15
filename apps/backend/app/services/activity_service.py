from app import db
from app.models import ActivityLog

MAX_ACTIVITY_PER_USER = 100


def log_activity(user_id: int, action: str, file_name: str,
                 folder_id: str = "all", details: str | None = None) -> None:
    entry = ActivityLog(
        user_id=user_id,
        action=action,
        file_name=file_name,
        folder_id=folder_id,
        details=details,
    )
    db.session.add(entry)
    db.session.flush()

    _trim_old_entries(user_id)


def _trim_old_entries(user_id: int) -> None:
    """Keep only the newest MAX_ACTIVITY_PER_USER entries per user."""
    count = ActivityLog.query.filter_by(user_id=user_id).count()
    if count <= MAX_ACTIVITY_PER_USER:
        return

    # Find the cutoff: the oldest entry we still want to keep (by id, not timestamp)
    keep_last = (
        ActivityLog.query
        .filter_by(user_id=user_id)
        .order_by(ActivityLog.id.desc())
        .offset(MAX_ACTIVITY_PER_USER - 1)
        .first()
    )
    if keep_last:
        ActivityLog.query.filter(
            ActivityLog.user_id == user_id,
            ActivityLog.id < keep_last.id,
        ).delete(synchronize_session=False)
