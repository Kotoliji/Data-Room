import os
from pathlib import Path
from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()

db = SQLAlchemy()
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
migrate = Migrate()

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"
BASELINE_REVISION = "0001_baseline"


def create_app() -> Flask:
    app = Flask(__name__, instance_relative_config=True)

    # Trust exactly one reverse proxy (Railway) for client IP and scheme
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

    secret = os.environ.get("SECRET_KEY", "")
    if len(secret) < 16:
        raise RuntimeError("SECRET_KEY must be set (16+ chars) — see apps/backend/.env.example")
    app.config["SECRET_KEY"] = secret
    app.config["TOKEN_ENCRYPTION_KEY"] = os.environ.get("TOKEN_ENCRYPTION_KEY", "")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///dataroom.db")
    # Render uses postgres:// but SQLAlchemy needs postgresql://
    if app.config["SQLALCHEMY_DATABASE_URI"].startswith("postgres://"):
        app.config["SQLALCHEMY_DATABASE_URI"] = app.config["SQLALCHEMY_DATABASE_URI"].replace("postgres://", "postgresql://", 1)
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["STORAGE_DIR"] = os.environ.get("STORAGE_DIR", str(Path(app.root_path).parent / "storage"))
    app.config["SMTP_USER"] = os.environ.get("SMTP_USER", "")
    app.config["SMTP_PASSWORD"] = os.environ.get("SMTP_PASSWORD", "")
    app.config["FRONTEND_URL"] = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    app.config["BACKEND_URL"] = os.environ.get("BACKEND_URL", "http://localhost:5000")
    app.config["GOOGLE_CLIENT_ID"] = os.environ.get("GOOGLE_CLIENT_ID", "")
    app.config["GOOGLE_CLIENT_SECRET"] = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    app.config["ANTHROPIC_API_KEY"] = os.environ.get("ANTHROPIC_API_KEY", "")
    app.config["INSIGHTS_ASYNC"] = os.environ.get("INSIGHTS_ASYNC", "1") != "0"

    CORS(app, origins=[app.config["FRONTEND_URL"]])
    db.init_app(app)
    limiter.init_app(app)
    migrate.init_app(app, db, directory=str(MIGRATIONS_DIR))

    from app.routes import register_blueprints
    register_blueprints(app)

    @app.errorhandler(429)
    def too_many_requests(_e):  # type: ignore[no-untyped-def]
        return jsonify({"data": None, "error": "Too many attempts — please try again later"}), 429

    with app.app_context():
        from app import models  # noqa: F401
        _upgrade_db(app)

    app.logger.info("App created successfully")
    return app


def _upgrade_db(app: Flask) -> None:
    """Apply Alembic migrations, adopting databases created before Alembic was added."""
    from flask_migrate import stamp, upgrade
    from sqlalchemy import inspect

    if not (MIGRATIONS_DIR / "env.py").exists():  # only while bootstrapping `flask db init`
        return
    tables = inspect(db.engine).get_table_names()
    if "users" in tables and "alembic_version" not in tables:
        _run_legacy_migrations(app)
        stamp(directory=str(MIGRATIONS_DIR), revision=BASELINE_REVISION)
        app.logger.info("Existing database stamped at Alembic baseline")
    upgrade(directory=str(MIGRATIONS_DIR))


def _run_legacy_migrations(app: Flask) -> None:
    """Bring a pre-Alembic database up to the baseline schema."""
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
