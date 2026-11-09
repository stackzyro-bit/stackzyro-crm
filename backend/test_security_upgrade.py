import sys
from fastapi import Request
from app.database import SessionLocal
from app.models import User, AuditLog
from app.security import verify_password
from app.schemas import LoginRequest, StaffCreate, StaffPasswordReset, FirstLoginPassword
from app.routers.auth import login, first_login_password, change_password
from app.routers.staff import create_staff, update_staff, admin_reset_password, toggle_status, list_staff
from app.routers.audit import list_audit_logs

class MockRequest:
    def __init__(self, ip="127.0.0.1"):
        self.headers = {"x-forwarded-for": ip}
        self.client = None

def run_security_upgrade_tests():
    print("=" * 65)
    print("      STACKZYRO CRM - SECURITY & UPGRADE VERIFICATION")
    print("=" * 65)
    db = SessionLocal()
    req = MockRequest()

    try:
        # TEST 1: Login with username OR email
        print("\n[TEST 1] Testing Login by Email AND by Username...")
        res_email = login(req, LoginRequest(email="admin@stackzyro.com", password="Admin@123"), db=db)
        assert res_email["access_token"] is not None
        assert res_email["user"]["email"] == "admin@stackzyro.com"

        res_user = login(req, LoginRequest(username_or_email="admin", password="Admin@123"), db=db)
        assert res_user["access_token"] is not None
        assert res_user["user"]["username"] == "admin"
        print("  [PASS] Successfully logged in using both email and username.")

        # TEST 2: Password never in serialized responses
        print("\n[TEST 2] Verifying Password & Hash Secrecy in Serializer...")
        assert "password" not in res_user["user"]
        assert "password_hash" not in res_user["user"]
        print("  [PASS] User response excludes password and password_hash.")

        # TEST 3: Create Staff with Employee ID, Department, Temp Password & Permissions
        print("\n[TEST 3] Creating New Staff with Temporary Password & Granular Permissions...")
        admin_user = db.query(User).filter(User.email == "admin@stackzyro.com").first()
        
        # Cleanup test user if exists
        test_email = "test.staff@stackzyro.com"
        test_user = db.query(User).filter(User.email == test_email).first()
        if test_user:
            db.delete(test_user)
            db.commit()

        staff_payload = StaffCreate(
            name="Zoya Khan",
            username="zoyakhan",
            email=test_email,
            phone="+91 98765 43210",
            staff_code="SZ-EMP-101",
            designation="Account Executive",
            department="Sales",
            role="staff",
            status="active",
            temporary_password="TempPassword@123",
            confirm_temporary_password="TempPassword@123",
            permissions={
                "dashboard": ["view"],
                "leads": ["view", "create"],
                "calls": ["view", "create"],
                "followups": ["view", "create"],
                "proposals": ["view"],
                "meetings": ["view"],
                "clients": ["view"],
                "attendance": ["view", "create"],
                "staff": [],
                "reports": [],
                "settings": [],
                "audit_logs": [],
            }
        )
        new_staff = create_staff(req, staff_payload, admin=admin_user, db=db)
        assert new_staff["username"] == "zoyakhan"
        assert new_staff["department"] == "Sales"
        assert new_staff["staff_code"] == "SZ-EMP-101"
        assert new_staff["must_change_password"] is True
        print(f"  [PASS] Staff member created: {new_staff['name']} ({new_staff['staff_code']}), must_change_password=True.")

        # TEST 4: First login with Temporary Password
        print("\n[TEST 4] Testing First Login with Temporary Password...")
        staff_login = login(req, LoginRequest(username_or_email="zoyakhan", password="TempPassword@123"), db=db)
        assert staff_login["must_change_password"] is True
        print("  [PASS] System detected must_change_password=True for staff first login.")

        # TEST 5: Set Permanent Password on First Login
        print("\n[TEST 5] Setting Permanent Password on First Login...")
        created_user = db.query(User).filter(User.username == "zoyakhan").first()
        pw_res = first_login_password(
            req,
            FirstLoginPassword(new_password="NewPermanent@123", confirm_password="NewPermanent@123"),
            user=created_user,
            db=db
        )
        db.refresh(created_user)
        assert created_user.must_change_password is False
        assert verify_password("NewPermanent@123", created_user.password_hash)
        print("  [PASS] Permanent password successfully set and validated.")

        # TEST 6: Admin Password Reset
        print("\n[TEST 6] Admin Resets Staff Password without Viewing...")
        reset_res = admin_reset_password(
            staff_id=created_user.id,
            payload=StaffPasswordReset(temporary_password="ResetTemp@123", require_password_change=True),
            request=req,
            admin=admin_user,
            db=db
        )
        db.refresh(created_user)
        assert created_user.must_change_password is True
        assert verify_password("ResetTemp@123", created_user.password_hash)
        print("  [PASS] Admin successfully initiated reset with new temporary password.")

        # TEST 7: Account Deactivation & Session Invalidation
        print("\n[TEST 7] Account Deactivation & Session Invalidation...")
        old_version = created_user.token_version
        toggled = toggle_status(created_user.id, request=req, admin=admin_user, db=db)
        db.refresh(created_user)
        assert created_user.status == "inactive"
        assert created_user.is_active is False
        assert created_user.token_version > old_version
        print("  [PASS] Staff account deactivated; token_version incremented to invalidate active sessions.")

        # TEST 8: Audit Logs Recorded
        print("\n[TEST 8] Verifying Audit Logs Tracking...")
        logs = list_audit_logs(admin=admin_user, db=db, page=1, page_size=20)
        assert len(logs["items"]) > 0
        actions = [item["action"] for item in logs["items"]]
        print(f"  [PASS] Retrieved {len(logs['items'])} audit log entries. Actions: {set(actions)}")

        print("\n" + "=" * 65)
        print("  ALL SECURITY & ACCESS CONTROL TESTS PASSED PERFECTLY! [OK]")
        print("=" * 65)
        return True

    except Exception as e:
        import traceback
        print(f"\n  [FAIL] Test encountered error: {e}")
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    ok = run_security_upgrade_tests()
    sys.exit(0 if ok else 1)
