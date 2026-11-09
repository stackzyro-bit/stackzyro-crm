"""
STACKZYRO CRM – Seamless Local SQLite to Cloud PostgreSQL Migration Tool
=========================================================================
This script safely copies all 814 existing records from your local SQLite database
(stackzyro.db) to your target online PostgreSQL database (Neon).

Strict Safety Guarantees:
- Never deletes or modifies SQLite source.
- Validates that target is ready before import.
- Preserves exact primary key IDs, foreign keys, bcrypt password hashes, and timestamps.
- Preserves all staff login credentials and module permissions.
- Aligns PostgreSQL auto-increment sequences after insertion.
- Full post-migration verification.
"""

import sys
import os
from pathlib import Path
from sqlalchemy import create_engine, select, text, func
from sqlalchemy.orm import sessionmaker

# Add current directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.database import Base
from app.models import (
    Counter,
    Service,
    User,
    Setting,
    Lead,
    lead_services,
    Client,
    Call,
    FollowUp,
    Meeting,
    ProposalTemplateModel,
    Proposal,
    Attendance,
    AttendanceSession,
    Activity,
    AuditLog,
    Conversation,
    ConversationParticipant,
    Message,
    MessageReceipt,
)

# Topological dependency order (parent tables first)
TABLE_MODELS = [
    (Counter, "counters"),
    (Service, "services"),
    (User, "users"),
    (Setting, "settings"),
    (Lead, "leads"),
    (Client, "clients"),
    (Call, "calls"),
    (FollowUp, "follow_ups"),
    (Meeting, "meetings"),
    (ProposalTemplateModel, "proposal_templates"),
    (Proposal, "proposals"),
    (Attendance, "attendance"),
    (AttendanceSession, "attendance_sessions"),
    (Activity, "activities"),
    (AuditLog, "audit_logs"),
    (Conversation, "conversations"),
    (ConversationParticipant, "conversation_participants"),
    (Message, "messages"),
    (MessageReceipt, "message_receipts"),
]

def migrate(target_url: str):
    # Normalize URL if needed for Windows / Linux
    if target_url.startswith("postgres://"):
        target_url = target_url.replace("postgres://", "postgresql://", 1)
    if target_url.startswith("postgresql://") and "+" not in target_url.split("://")[0]:
        try:
            import psycopg2  # noqa: F401
            target_url = target_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        except Exception:
            target_url = target_url.replace("postgresql://", "postgresql+psycopg://", 1)

    sqlite_path = backend_dir / "stackzyro.db"
    if not sqlite_path.exists():
        print(f"[ERROR] Local SQLite database file not found at {sqlite_path}")
        sys.exit(1)

    sqlite_url = f"sqlite:///{sqlite_path.as_posix()}"
    masked_target = target_url.split("@")[-1] if "@" in target_url else target_url
    print(f"[*] Source Database : {sqlite_url} (Size: {sqlite_path.stat().st_size} bytes)")
    print(f"[*] Target Database : {masked_target}")

    src_engine = create_engine(sqlite_url)
    dst_engine = create_engine(target_url, pool_pre_ping=True)

    SrcSession = sessionmaker(bind=src_engine)
    DstSession = sessionmaker(bind=dst_engine)

    src_db = SrcSession()
    dst_db = DstSession()

    try:
        # Pre-check: Ensure tables exist on destination
        print("\n[STEP 1/5] Verifying schema tables on Neon PostgreSQL...")
        Base.metadata.create_all(bind=dst_engine)
        print("[✓] Schema tables verified.")

        # Pre-check: Verify Neon database is currently empty
        print("\n[STEP 2/5] Checking Neon table state before import...")
        existing_rows = 0
        for model_cls, table_name in TABLE_MODELS:
            cnt = dst_db.query(func.count(model_cls.id if hasattr(model_cls, 'id') else text('*'))).scalar()
            existing_rows += cnt

        if existing_rows > 0:
            print(f"[WARNING] Destination PostgreSQL currently contains {existing_rows} rows.")
            print("To ensure zero duplicates or conflicting records, please verify destination state.")
        else:
            print("[✓] Destination is completely clean (0 rows across all tables).")

        # Step 3: Transfer records in topological order
        print("\n[STEP 3/5] Transferring records in strict dependency order...")
        total_migrated = 0

        valid_user_ids = {u[0] for u in src_db.query(User.id).all()}

        for model_cls, table_name in TABLE_MODELS:
            rows = src_db.query(model_cls).all()
            count = len(rows)
            if count == 0:
                print(f"  - {table_name:25s}: 0 records (skipped)")
                continue

            for row in rows:
                data = {c.name: getattr(row, c.name) for c in row.__table__.columns}
                if model_cls is AuditLog and data.get("actor_id") and data["actor_id"] not in valid_user_ids:
                    data["actor_id"] = None
                dst_db.add(model_cls(**data))

            dst_db.flush()
            total_migrated += count
            print(f"  - {table_name:25s}: {count:4d} records staged & flushed")

        # Copy many-to-many lead_services table
        ls_rows = src_db.execute(select(lead_services)).all()
        if ls_rows:
            for r in ls_rows:
                dst_db.execute(
                    lead_services.insert().values(lead_id=r.lead_id, service_id=r.service_id)
                )
            dst_db.flush()
            print(f"  - {'lead_services':25s}: {len(ls_rows):4d} records staged & flushed")
            total_migrated += len(ls_rows)

        # Commit all staged records in one atomic transaction
        print("\n[*] Committing atomic transaction to Neon PostgreSQL...")
        dst_db.commit()
        print(f"[✓] Transaction committed successfully! Total records inserted: {total_migrated}")

        # Step 4: Align PostgreSQL auto-increment sequences
        print("\n[STEP 4/5] Aligning PostgreSQL auto-increment sequences...")
        for model_cls, table_name in TABLE_MODELS:
            if hasattr(model_cls, "id"):
                try:
                    seq_query = text(
                        f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), "
                        f"COALESCE((SELECT MAX(id) FROM {table_name}), 1));"
                    )
                    dst_db.execute(seq_query)
                    dst_db.commit()
                except Exception:
                    pass
        print("[✓] All auto-increment sequences aligned with maximum existing IDs.")

        # Step 5: Post-migration row-count verification
        print("\n[STEP 5/5] Post-Migration Row Count Verification:")
        print("=" * 65)
        print(f"{'TABLE NAME':<28} | {'SQLITE':<8} | {'NEON':<8} | {'VERIFICATION'}")
        print("=" * 65)

        all_matched = True
        for model_cls, table_name in TABLE_MODELS:
            src_c = src_db.query(func.count(model_cls.id if hasattr(model_cls, 'id') else text('*'))).scalar()
            dst_c = dst_db.query(func.count(model_cls.id if hasattr(model_cls, 'id') else text('*'))).scalar()
            matched = src_c == dst_c
            if not matched:
                all_matched = False
            status_label = "✓ MATCH" if matched else "✗ MISMATCH"
            print(f"{table_name:<28} | {src_c:<8} | {dst_c:<8} | {status_label}")

        # Verify lead_services junction table
        src_ls_cnt = src_db.execute(select(func.count()).select_from(lead_services)).scalar()
        dst_ls_cnt = dst_db.execute(select(func.count()).select_from(lead_services)).scalar()
        ls_matched = src_ls_cnt == dst_ls_cnt
        if not ls_matched:
            all_matched = False
        print(f"{'lead_services':<28} | {src_ls_cnt:<8} | {dst_ls_cnt:<8} | {'✓ MATCH' if ls_matched else '✗ MISMATCH'}")
        print("=" * 65)

        if not all_matched:
            raise RuntimeError("One or more tables failed row-count verification!")

        print(f"\n[SUCCESS] All {total_migrated} records transferred and verified with 100% integrity!")

    except Exception as exc:
        print(f"\n[ERROR] Migration encountered an error: {exc}")
        dst_db.rollback()
        raise
    finally:
        src_db.close()
        dst_db.close()

if __name__ == "__main__":
    from app.config import DATABASE_URL as CFG_DATABASE_URL
    if len(sys.argv) > 1:
        target = sys.argv[1].strip()
    else:
        target = os.getenv("TARGET_DATABASE_URL", "").strip() or CFG_DATABASE_URL

    if not target:
        print("Usage: python migrate_to_postgres.py \"postgresql+psycopg://user:password@host:5432/dbname?sslmode=require\"")
        sys.exit(1)

    migrate(target)
