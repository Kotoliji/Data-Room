from sqlalchemy import create_engine, inspect, text

from app import BASELINE_REVISION, create_app, db


def test_fresh_database_is_migrated(app):
    with app.app_context():
        assert "alembic_version" in inspect(db.engine).get_table_names()


def test_pre_alembic_database_is_adopted(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'legacy.db'}"
    engine = create_engine(url)
    with engine.begin() as conn:  # schema as created by db.create_all() before later columns were added
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(120), email VARCHAR(120))"))
        conn.execute(text("CREATE TABLE folders (id INTEGER PRIMARY KEY, name VARCHAR(255), user_id INTEGER)"))
        conn.execute(text("CREATE TABLE files (id INTEGER PRIMARY KEY, name VARCHAR(255), user_id INTEGER)"))
    engine.dispose()

    monkeypatch.setenv("SECRET_KEY", "test-secret-key-0123456789")
    monkeypatch.setenv("DATABASE_URL", url)
    app = create_app()
    with app.app_context():
        assert db.session.execute(text("SELECT version_num FROM alembic_version")).scalar() >= BASELINE_REVISION
        assert "status" in [c["name"] for c in inspect(db.engine).get_columns("folders")]
        db.engine.dispose()
