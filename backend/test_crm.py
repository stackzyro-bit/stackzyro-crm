import sys
import traceback
from datetime import date
from app.database import SessionLocal, check_connection
from app.models import User, Lead, Client, Proposal, Call, FollowUp, Attendance, Activity
from app.security import verify_password, create_access_token, decode_access_token
from app.routers.dashboard import dashboard
from app.routers.leads import list_leads
from app.routers.clients import list_clients
from app.routers.reports import get_report
from app.routers.attendance import list_attendance

def run_crm_tests():
    print("=" * 65)
    print("      STACKZYRO CRM - COMPREHENSIVE AUTOMATED TEST SUITE")
    print("=" * 65)
    
    # 1. Database Connection Test
    print("\n[TEST 1] Database Connection & Engine Integrity")
    try:
        check_connection()
        print("  [PASS] Database connection established successfully.")
    except Exception as e:
        print(f"  [FAIL] Database connection failed: {e}")
        return False

    db = SessionLocal()
    try:
        # 2. Database Record Verification
        print("\n[TEST 2] Verifying Core CRM Tables & Seed Records")
        users = db.query(User).all()
        leads = db.query(Lead).all()
        clients = db.query(Client).all()
        proposals = db.query(Proposal).all()
        calls = db.query(Call).all()
        followups = db.query(FollowUp).all()
        attendance = db.query(Attendance).all()
        activities = db.query(Activity).all()

        print(f"  [+] Users in database: {len(users)}")
        print(f"  [+] Leads count: {len(leads)}")
        print(f"  [+] Clients count: {len(clients)}")
        print(f"  [+] Proposals count: {len(proposals)}")
        print(f"  [+] Call logs count: {len(calls)}")
        print(f"  [+] Follow-ups count: {len(followups)}")
        print(f"  [+] Attendance records: {len(attendance)}")
        print(f"  [+] Audit activity logs: {len(activities)}")

        assert len(users) >= 2, "Expected at least 2 users (Admin & Staff)"
        assert len(leads) > 0, "Expected leads in the database"

        # 3. Authentication & Security Test
        print("\n[TEST 3] Authentication, Password Hashing & JWT Security")
        admin = db.query(User).filter(User.email == "admin@stackzyro.com").first()
        staff = db.query(User).filter(User.email == "ayesha@stackzyro.com").first()

        assert admin is not None, "Admin user (admin@stackzyro.com) not found"
        assert staff is not None, "Staff user (ayesha@stackzyro.com) not found"

        admin_pass_valid = verify_password("Admin@123", admin.password_hash)
        staff_pass_valid = verify_password("Staff@123", staff.password_hash)
        wrong_pass_valid = verify_password("WrongPassword!", admin.password_hash)

        assert admin_pass_valid, "Admin password verification failed"
        assert staff_pass_valid, "Staff password verification failed"
        assert not wrong_pass_valid, "Invalid password was incorrectly accepted"
        print("  [PASS] Admin & Staff credentials verified against bcrypt hash.")

        token = create_access_token(admin.id, admin.role)
        decoded = decode_access_token(token)
        assert decoded is not None and decoded.get("sub") == str(admin.id)
        assert decoded.get("role") == admin.role
        print("  [PASS] JWT access token minted and claims verified.")

        # 4. Dashboard Router (Admin & Staff scopes)
        print("\n[TEST 4] Dashboard Calculations & Metrics Engine")
        admin_dash = dashboard(user=admin, db=db)
        assert admin_dash["role"] == "admin"
        assert "metrics" in admin_dash
        assert "lead_status_overview" in admin_dash
        assert "attendance_summary" in admin_dash
        print(f"  [PASS] Admin Dashboard: Total leads metric = {admin_dash['metrics']['total_leads']['value']}, Today's calls = {admin_dash['today_calls']}")

        staff_dash = dashboard(user=staff, db=db)
        assert staff_dash["role"] == "staff"
        assert "metrics" in staff_dash
        print(f"  [PASS] Staff Dashboard: Staff assigned leads = {staff_dash['metrics']['my_leads']['value']}")

        # 5. Leads Router
        print("\n[TEST 5] Leads API & Pagination")
        leads_res = list_leads(user=admin, db=db, page=1, page_size=10, q=None, status="all", staff_id=None, service_id=None, date_from=None, date_to=None, sort="newest")
        assert "items" in leads_res
        assert "total" in leads_res
        print(f"  [PASS] Admin fetched {len(leads_res['items'])} leads on page 1 (Total: {leads_res['total']}).")

        # 6. Clients Router
        print("\n[TEST 6] Clients API")
        clients_res = list_clients(user=admin, db=db, page=1, page_size=10, q=None, status="all", staff_id=None)
        assert "items" in clients_res
        print(f"  [PASS] Fetched {len(clients_res['items'])} active clients (Total: {clients_res['total']}).")

        # 7. Reports Router
        print("\n[TEST 7] Reports & Analytics Aggregation")
        reports_res = get_report(preset="last_30_days", date_from=None, date_to=None, admin=admin, db=db)
        assert isinstance(reports_res, dict)
        print("  [PASS] KPI & Performance Reports computed successfully.")

        # 8. Attendance Router
        print("\n[TEST 8] Attendance Tracking")
        att_res = list_attendance(work_date=None, staff_id=None, status=None, date_from=None, date_to=None, page=1, page_size=10, user=admin, db=db)
        assert "items" in att_res
        print(f"  [PASS] Attendance records retrieved: {len(att_res['items'])} on page 1.")

        print("\n" + "=" * 65)
        print("  ALL 8 CRM BACKEND VERIFICATION CHECKS PASSED PERFECTLY! [OK]")
        print("=" * 65)
        return True

    except Exception as e:
        print(f"\n  [FAIL] TEST FAILED: {e}")
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = run_crm_tests()
    sys.exit(0 if success else 1)
