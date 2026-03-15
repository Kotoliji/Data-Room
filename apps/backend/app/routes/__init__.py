from flask import Flask


def register_blueprints(app: Flask) -> None:
    from .auth import auth_bp
    from .google import google_bp
    from .files import files_bp
    from .drive import drive_bp
    from .activity import activity_bp
    from .folders import folders_bp

    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(google_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(files_bp, url_prefix="/api/v1/files")
    app.register_blueprint(drive_bp, url_prefix="/api/v1/drive")
    app.register_blueprint(activity_bp, url_prefix="/api/v1/activity")
    app.register_blueprint(folders_bp, url_prefix="/api/v1/folders")
