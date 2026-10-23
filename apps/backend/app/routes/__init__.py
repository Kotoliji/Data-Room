from flask import Flask


def register_blueprints(app: Flask) -> None:
    from .auth import auth_bp
    from .google import google_bp
    from .files import files_bp
    from .drive import drive_bp
    from .activity import activity_bp
    from .folders import folders_bp
    from .shares import shares_bp, public_bp
    from .diligence import diligence_bp
    from .questions import questions_bp

    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(google_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(files_bp, url_prefix="/api/v1/files")
    app.register_blueprint(drive_bp, url_prefix="/api/v1/drive")
    app.register_blueprint(activity_bp, url_prefix="/api/v1/activity")
    app.register_blueprint(folders_bp, url_prefix="/api/v1/folders")
    app.register_blueprint(shares_bp, url_prefix="/api/v1/shares")
    app.register_blueprint(public_bp, url_prefix="/api/v1/public/shares")
    app.register_blueprint(diligence_bp, url_prefix="/api/v1")
    app.register_blueprint(questions_bp, url_prefix="/api/v1/questions")
