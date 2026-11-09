import logging
from sqlalchemy import text
from .database import engine

logger = logging.getLogger("stackzyro.migrations")

def apply_migrations():
    """
    Safely adds missing columns and indices to SQLite or PostgreSQL tables without deleting data.
    Works seamlessly on both local SQLite and production PostgreSQL databases.
    """
    is_sqlite = "sqlite" in str(engine.url)
    with engine.connect() as conn:
        # 1. Inspect existing columns in users table
        try:
            if is_sqlite:
                res = conn.execute(text("PRAGMA table_info(users)"))
                existing_cols = {row[1] for row in res.fetchall()}
            else:
                res = conn.execute(
                    text("SELECT column_name FROM information_schema.columns WHERE table_name='users'")
                )
                existing_cols = {row[0].lower() for row in res.fetchall()}
        except Exception as e:
            logger.warning("Could not inspect users table: %s", e)
            return

        cols_to_add = [
            ("username", "VARCHAR(60)"),
            ("department", "VARCHAR(100)"),
            ("status", "VARCHAR(20) DEFAULT 'active'"),
            ("must_change_password", "BOOLEAN DEFAULT 0" if is_sqlite else "BOOLEAN DEFAULT FALSE"),
            ("token_version", "INTEGER DEFAULT 1"),
            ("failed_login_attempts", "INTEGER DEFAULT 0"),
            ("locked_until", "DATETIME" if is_sqlite else "TIMESTAMP"),
            ("last_login_at", "DATETIME" if is_sqlite else "TIMESTAMP"),
            ("last_login_ip", "VARCHAR(64)"),
            ("permissions", "TEXT"),
        ]

        for col_name, col_type in cols_to_add:
            if col_name not in existing_cols:
                try:
                    logger.info("Adding missing column '%s' to users table", col_name)
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception as ex:
                    logger.warning("Could not add column %s: %s", col_name, ex)

        # 2. Backfill existing users: username, status, token_version
        try:
            if is_sqlite:
                user_backfill_sql = """
                    UPDATE users 
                    SET username = SUBSTR(email, 1, INSTR(email, '@') - 1),
                        status = CASE WHEN is_active = 1 THEN 'active' ELSE 'inactive' END,
                        token_version = COALESCE(token_version, 1),
                        failed_login_attempts = COALESCE(failed_login_attempts, 0),
                        must_change_password = COALESCE(must_change_password, 0)
                    WHERE username IS NULL OR status IS NULL
                """
            else:
                user_backfill_sql = """
                    UPDATE users 
                    SET username = SUBSTR(email, 1, POSITION('@' IN email) - 1),
                        status = CASE WHEN is_active = TRUE THEN 'active' ELSE 'inactive' END,
                        token_version = COALESCE(token_version, 1),
                        failed_login_attempts = COALESCE(failed_login_attempts, 0),
                        must_change_password = COALESCE(must_change_password, FALSE)
                    WHERE username IS NULL OR status IS NULL
                """
            conn.execute(text(user_backfill_sql))
            conn.commit()
            logger.info("User backfill migration complete.")
        except Exception as ex:
            logger.warning("User backfill error: %s", ex)

        # 3. Inspect and alter attendance table for multi-session metrics
        try:
            if is_sqlite:
                res = conn.execute(text("PRAGMA table_info(attendance)"))
                attendance_cols = {row[1] for row in res.fetchall()}
            else:
                res = conn.execute(
                    text("SELECT column_name FROM information_schema.columns WHERE table_name='attendance'")
                )
                attendance_cols = {row[0].lower() for row in res.fetchall()}

            att_cols_to_add = [
                ("total_working_seconds", "INTEGER DEFAULT 0"),
                ("total_break_seconds", "INTEGER DEFAULT 0"),
                ("exit_count", "INTEGER DEFAULT 0"),
                ("is_flagged", "BOOLEAN DEFAULT 0" if is_sqlite else "BOOLEAN DEFAULT FALSE"),
                ("flag_reason", "VARCHAR(255)"),
            ]
            for col_name, col_type in att_cols_to_add:
                if col_name not in attendance_cols:
                    conn.execute(text(f"ALTER TABLE attendance ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
        except Exception as ex:
            logger.warning("Could not alter attendance table: %s", ex)

        # 4. Create index on attendance_sessions if table exists
        try:
            conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_att_sessions_user_date ON attendance_sessions(user_id, work_date)")
            )
            conn.commit()
        except Exception:
            pass

        # 5. Backfill initial session for existing attendance records if sessions table is empty
        try:
            session_count = conn.execute(text("SELECT COUNT(*) FROM attendance_sessions")).scalar()
            if session_count == 0:
                if is_sqlite:
                    conn.execute(
                        text("""
                            INSERT INTO attendance_sessions (user_id, work_date, session_number, check_in, check_out, check_out_reason, working_seconds, status, is_manual, created_at)
                            SELECT 
                                user_id, 
                                work_date, 
                                1, 
                                check_in, 
                                check_out, 
                                CASE WHEN check_out IS NOT NULL THEN 'End of Day' ELSE NULL END,
                                CASE 
                                    WHEN check_in IS NOT NULL AND check_out IS NOT NULL 
                                    THEN CAST((strftime('%s', check_out) - strftime('%s', check_in)) AS INTEGER)
                                    ELSE NULL 
                                END,
                                CASE WHEN check_out IS NOT NULL THEN 'completed' ELSE 'active' END,
                                0,
                                COALESCE(check_in, DATETIME('now'))
                            FROM attendance
                            WHERE check_in IS NOT NULL
                        """)
                    )
                    conn.commit()
                    conn.execute(
                        text("""
                            UPDATE attendance
                            SET exit_count = CASE WHEN check_out IS NOT NULL THEN 1 ELSE 0 END,
                                total_working_seconds = COALESCE(
                                    CASE 
                                        WHEN check_in IS NOT NULL AND check_out IS NOT NULL 
                                        THEN CAST((strftime('%s', check_out) - strftime('%s', check_in)) AS INTEGER)
                                        ELSE 0 
                                    END, 
                                    0
                                )
                            WHERE check_in IS NOT NULL
                        """)
                    )
                else:
                    conn.execute(
                        text("""
                            INSERT INTO attendance_sessions (user_id, work_date, session_number, check_in, check_out, check_out_reason, working_seconds, status, is_manual, created_at)
                            SELECT 
                                user_id, 
                                work_date, 
                                1, 
                                check_in, 
                                check_out, 
                                CASE WHEN check_out IS NOT NULL THEN 'End of Day' ELSE NULL END,
                                CASE 
                                    WHEN check_in IS NOT NULL AND check_out IS NOT NULL 
                                    THEN CAST(EXTRACT(EPOCH FROM (check_out - check_in)) AS INTEGER)
                                    ELSE NULL 
                                END,
                                CASE WHEN check_out IS NOT NULL THEN 'completed' ELSE 'active' END,
                                FALSE,
                                COALESCE(check_in, CURRENT_TIMESTAMP)
                            FROM attendance
                            WHERE check_in IS NOT NULL
                        """)
                    )
                    conn.commit()
                    conn.execute(
                        text("""
                            UPDATE attendance
                            SET exit_count = CASE WHEN check_out IS NOT NULL THEN 1 ELSE 0 END,
                                total_working_seconds = COALESCE(
                                    CASE 
                                        WHEN check_in IS NOT NULL AND check_out IS NOT NULL 
                                        THEN CAST(EXTRACT(EPOCH FROM (check_out - check_in)) AS INTEGER)
                                        ELSE 0 
                                    END, 
                                    0
                                )
                            WHERE check_in IS NOT NULL
                        """)
                    )
                conn.commit()
                logger.info("Backfilled attendance sessions from legacy records.")
        except Exception as ex:
            logger.warning("Attendance sessions backfill note: %s", ex)
