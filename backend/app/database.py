import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL

logger = logging.getLogger("stackzyro")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

# Reports whether PostgreSQL or the local fallback is active.
ACTIVE_DATABASE_URL = DATABASE_URL


class Base(DeclarativeBase):
    pass


def database_label() -> str:
    if ACTIVE_DATABASE_URL.startswith("postgresql"):
        return "PostgreSQL"
    return "SQLite (local development fallback)"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_connection() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    logger.info("Connected to %s", database_label())
