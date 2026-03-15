import os
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv

load_dotenv()

db = SQLAlchemy()


def create_app() -> Flask:
    app = Flask(__name__, instance_relative_config=True)

    secret = os.environ.get("SECRET_KEY", "dev-secret-key")
    if secret == "dev-secret-key":
        app.logger.warning("SECRET_KEY not set — using insecure default. Set it in .env!")
    app.config["SECRET_KEY"] = secret
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///dataroom.db")
    # Render uses postgres:// but SQLAlchemy needs postgresql://
    if app.config["SQLALCHEMY_DATABASE_URI"].startswith("postgres://"):
        app.config["SQLALCHEMY_DATABASE_URI"] = app.config["SQLALCHEMY_DATABASE_URI"].replace("postgres://", "postgresql://", 1)
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SMTP_USER"] = os.environ.get("SMTP_USER", "")
    app.config["SMTP_PASSWORD"] = os.environ.get("SMTP_PASSWORD", "")
    app.config["FRONTEND_URL"] = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    app.config["BACKEND_URL"] = os.environ.get("BACKEND_URL", "http://localhost:5000")
    app.config["GOOGLE_CLIENT_ID"] = os.environ.get("GOOGLE_CLIENT_ID", "")
    app.config["GOOGLE_CLIENT_SECRET"] = os.environ.get("GOOGLE_CLIENT_SECRET", "")

    CORS(app, origins=[app.config["FRONTEND_URL"]])
    db.init_app(app)

    from app.routes import register_blueprints
    register_blueprints(app)

    with app.app_context():
        from app.models import User, Session  # noqa: F401
        db.create_all()
        _run_migrations(app)

    app.logger.info("App created successfully")
    return app


def _run_migrations(app: Flask) -> None:
    """Run lightweight ALTER TABLE migrations for new columns."""
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)

    # Add 'status' column to folders table
    if "folders" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("folders")]
        if "status" not in columns:
            db.session.execute(
                text("ALTER TABLE folders ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'")
            )
            db.session.commit()
            app.logger.info("Migration: added 'status' column to folders table")

    # Add 'original_folder_id' column to files table
    if "files" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("files")]
        if "original_folder_id" not in columns:
            db.session.execute(
                text("ALTER TABLE files ADD COLUMN original_folder_id VARCHAR(100)")
            )
            db.session.commit()
            app.logger.info("Migration: added 'original_folder_id' column to files table")
