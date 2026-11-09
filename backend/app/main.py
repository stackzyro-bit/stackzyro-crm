import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from .config import CORS_ORIGINS, SEED_SAMPLE_DATA
from .database import ACTIVE_DATABASE_URL, Base, SessionLocal, check_connection, database_label, engine
from .routers import (
    activities,
    attendance,
    audit,
    auth,
    calls,
    clients,
    dashboard,
    followups,
    leads,
    meetings,
    messages,
    meta,
    proposals,
    reports,
    settings,
    staff,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("stackzyro")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from . import models  # noqa: F401 - register metadata
    from .migrations import apply_migrations

    Base.metadata.create_all(bind=engine)
    apply_migrations()
    try:
        check_connection()
    except Exception as exc:  # pragma: no cover
        logger.error("Database connection failed: %s", exc)
        raise
    logger.info("STACKZYRO CRM API ready on %s", database_label())

    db = SessionLocal()
    try:
        from .seed import seed_if_empty

        if SEED_SAMPLE_DATA:
            seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="STACKZYRO CRM API",
    description="CRM for STACKZYRO — Turning Ideas Into Digital Solutions.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in [
    auth.router,
    meta.router,
    dashboard.router,
    leads.router,
    calls.router,
    followups.router,
    proposals.router,
    meetings.router,
    messages.router,
    clients.router,
    attendance.router,
    staff.router,
    reports.router,
    settings.router,
    activities.router,
    audit.router,
]:
    app.include_router(router)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.warning("Integrity error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=409,
        content={"detail": "This record conflicts with existing data. Please review and retry."},
    )


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "STACKZYRO CRM API",
        "database": "postgresql" if ACTIVE_DATABASE_URL.startswith("postgresql") else "sqlite",
    }
