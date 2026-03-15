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
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///dataroom.db"
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

    app.logger.info("App created successfully")
    return app
