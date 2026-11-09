import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Database URL with automatic cloud provider normalization (postgres:// -> postgresql+psycopg2://)
raw_db_url = os.getenv("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'stackzyro.db').as_posix()}")
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

if raw_db_url.startswith("postgresql://") and "+" not in raw_db_url.split("://")[0]:
    try:
        import psycopg2  # noqa: F401
        DATABASE_URL = raw_db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    except Exception:
        DATABASE_URL = raw_db_url.replace("postgresql://", "postgresql+psycopg://", 1)
else:
    DATABASE_URL = raw_db_url

SECRET_KEY = os.getenv("SECRET_KEY", "stackzyro-development-secret-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))

# CORS allowed origins (supports comma-separated list or wildcard)
cors_env = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").strip()
if cors_env == "*":
    CORS_ORIGINS = ["*"]
else:
    CORS_ORIGINS = [origin.strip() for origin in cors_env.split(",") if origin.strip()]

SEED_SAMPLE_DATA = os.getenv("SEED_SAMPLE_DATA", "true").lower() in {"1", "true", "yes"}
