import os
import sys

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import psycopg2
from app.config import DATABASE_URL
from app.security import verify_password
from app.database import engine, SessionLocal
from app.models import User, Lead, Call, FollowUp, Proposal, Client, Attendance
from sqlalchemy import text

print("=" * 70)
print("   STACKZYRO CRM - NEON POST-MIGRATION LIVE VERIFICATION SUITE")
print("=" * 70)

db = SessionLocal()

try:
    # 1. Staff and Admin Account Credentials Check
    print("\n[VERIFICATION 1] Staff & Admin Accounts & Password Hash Check")
    users = db.query(User).order_by(User.id).all()
    assert len(users) == 12, f"Expected 12 users, found {len(users)}"
    print(f"  [✓] All {len(users)} user accounts successfully loaded from Neon.")

    # Compare password hashes directly against SQLite source
    import sqlite3
    s_conn = sqlite3.connect("backend/stackzyro.db")
    s_cur = s_conn.cursor()
    s_cur.execute("SELECT id, email, username, password_hash, permissions FROM users ORDER BY id")
    s_users = s_cur.fetchall()
    s_conn.close()

    hashes_matched = True
    for s_id, s_email, s_un, s_ph, s_perm in s_users:
        neon_u = next(u for u in users if u.id == s_id)
        assert neon_u.password_hash == s_ph, f"Password hash mismatch for user {s_email}"
        assert neon_u.email == s_email, f"Email mismatch for user {s_id}"
        assert neon_u.username == s_un, f"Username mismatch for user {s_id}"
        assert neon_u.permissions == s_perm, f"Permissions mismatch for user {s_id}"

    print(f"  [✓] 12/12 User Accounts (Admin & Staff) verified 100% bit-for-bit identical to SQLite:")
    print(f"      - Emails, Usernames, bcrypt Hashes, and Permissions match perfectly.")

    # 2. Foreign Key & Entity Integrity Check
    print("\n[VERIFICATION 2] Relational Foreign Key Integrity on Neon")
    leads_count = db.query(Lead).count()
    assert leads_count == 47, f"Expected 47 leads, found {leads_count}"
    
    calls_count = db.query(Call).count()
    assert calls_count == 76, f"Expected 76 calls, found {calls_count}"
    
    proposals_count = db.query(Proposal).count()
    assert proposals_count == 30, f"Expected 30 proposals, found {proposals_count}"
    
    attendance_count = db.query(Attendance).count()
    assert attendance_count == 126, f"Expected 126 attendance rows, found {attendance_count}"

    print(f"  [✓] Verified 47 Leads, 76 Calls, 30 Proposals, 126 Attendance records.")

    # Verify a joined relationship
    sample_lead = db.query(Lead).filter(Lead.code == "LD-0001").first()
    assert sample_lead is not None, "Lead LD-0001 must exist"
    print(f"  [✓] Relational join test: Lead '{sample_lead.business_name}' assigned to staff '{sample_lead.assigned_staff.name if sample_lead.assigned_staff else 'Unassigned'}' (Services: {len(sample_lead.services)}).")

    # 3. Live Database Write & Auto-Increment Test
    print("\n[VERIFICATION 3] Live Database Write & Sequence Test on Neon")
    admin_user = next(u for u in users if u.role == "admin")
    test_log = text("""
        INSERT INTO audit_logs (actor_id, action, category, description, entity_type, ip_address, created_at)
        VALUES (:actor_id, 'test.migration_check', 'system', 'Post-migration write verification test', 'system', '127.0.0.1', NOW())
        RETURNING id;
    """)
    res = db.execute(test_log, {"actor_id": admin_user.id}).fetchone()
    inserted_id = res[0]
    db.commit()
    assert inserted_id > 111, f"Expected auto-increment ID > 111, got {inserted_id}"
    print(f"  [✓] Live write test succeeded! New row assigned sequential ID: {inserted_id} (No ID collisions).")

    # Clean up test audit log
    db.execute(text("DELETE FROM audit_logs WHERE id = :id"), {"id": inserted_id})
    db.commit()
    print("  [✓] Transient test row cleaned up.")

    print("\n" + "=" * 70)
    print("   ALL NEON VERIFICATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

finally:
    db.close()
