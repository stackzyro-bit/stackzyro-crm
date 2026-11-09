import sys
import traceback
from app.database import SessionLocal
from app.models import User
from app.routers.staff import (
    create_staff,
    list_staff,
    update_staff,
    admin_reset_password,
    toggle_status,
)
from app.routers.auth import login, first_login_password
from app.schemas import StaffCreate, StaffUpdate, StaffPasswordReset, LoginRequest, FirstLoginPassword
from app.security import verify_password
from fastapi import Request

class DummyRequest:
    def __init__(self, host="127.0.0.1"):
        self.client = type("Client", (), {"host": host})()
        self.headers = {}

def run_tests():
    print("=" * 65)
    print("   STAFF LOGIN CREDENTIALS MANAGEMENT - AUTOMATED TEST SUITE")
    print("=" * 65)

    db = SessionLocal()
    req = DummyRequest()
    try:
        admin = db.query(User).filter(User.email == "admin@stackzyro.com").first()
        assert admin is not None, "Admin not found"

        # Cleanup test user if exists from earlier run
        existing = db.query(User).filter(User.username.in_(["staff001", "staff001_edited"])).all()
        for u in existing:
            db.delete(u)
        db.commit()

        # 1. Create Staff with Manual Username & Initial Password
        print("\n[TEST 1] Create Staff Login Account with Manual Username & Password")
        payload = StaffCreate(
            name="Rohan Verma",
            username="staff001",
            email="rohan.verma@stackzyro.com",
            phone="+91 98765 11111",
            designation="Office Assistant",
            department="Operations",
            role="staff",
            status="active",
            temporary_password="StaffInitial123!",
            confirm_temporary_password="StaffInitial123!",
            must_change_password=True,
            permissions={"leads": ["view"], "attendance": ["view", "create"]},
        )
        created = create_staff(request=req, payload=payload, admin=admin, db=db)
        print(f"  [PASS] Created staff {created['name']} with username @{created['username']}.")
        assert created["username"] == "staff001"
        assert created["status"] == "active"
        assert created["must_change_password"] is True
        assert "password" not in created
        assert "password_hash" not in created

        staff_id = created["id"]
        db_member = db.get(User, staff_id)
        assert db_member is not None
        # Verify password is encrypted with bcrypt
        assert verify_password("StaffInitial123!", db_member.password_hash)
        assert db_member.password_hash != "StaffInitial123!"
        print("  [PASS] Password stored securely as bcrypt hash. Plain text never stored.")

        # 2. Validate Username Uniqueness
        print("\n[TEST 2] Validate Username Uniqueness Protection")
        dup_failed = False
        try:
            dup_payload = StaffCreate(
                name="Duplicate User",
                username="staff001",
                email="another@stackzyro.com",
                temporary_password="StaffInitial123!",
                confirm_temporary_password="StaffInitial123!",
            )
            create_staff(request=req, payload=dup_payload, admin=admin, db=db)
        except Exception as e:
            dup_failed = True
            print(f"  [PASS] Correctly rejected duplicate username: {e.detail}")
        assert dup_failed, "Should reject duplicate username"

        # 3. Staff Account Table Output Validation
        print("\n[TEST 3] Verify Staff Account Table Output (No passwords exposed)")
        listing = list_staff(q="staff001", admin=admin, db=db)
        items = listing["items"]
        assert len(items) == 1
        item = items[0]
        assert item["username"] == "staff001"
        assert item["role"] == "staff"
        assert item["status"] == "active"
        assert "password" not in item
        assert "password_hash" not in item
        print(f"  [PASS] Table fields: Employee={item['name']}, Username={item['username']}, Role={item['designation']}, Status={item['status']}")

        # 4. Admin Edit Username
        print("\n[TEST 4] Admin Edit Username")
        update_res = update_staff(
            staff_id=staff_id,
            payload=StaffUpdate(username="staff001_edited"),
            request=req,
            admin=admin,
            db=db,
        )
        assert update_res["username"] == "staff001_edited"
        print(f"  [PASS] Updated username to @{update_res['username']}.")

        # 5. Admin Reset Staff Password & Force Password Change
        print("\n[TEST 5] Admin Reset Staff Password")
        old_token_version = db_member.token_version
        reset_res = admin_reset_password(
            staff_id=staff_id,
            payload=StaffPasswordReset(temporary_password="NewTempPass456!", require_password_change=True),
            request=req,
            admin=admin,
            db=db,
        )
        db.refresh(db_member)
        assert verify_password("NewTempPass456!", db_member.password_hash)
        assert db_member.must_change_password is True
        assert db_member.token_version > old_token_version, "Old sessions should be invalidated"
        print("  [PASS] Temporary password updated and old sessions invalidated.")

        # 6. Staff Login Using Username
        print("\n[TEST 6] Staff Login using Username & Temporary Password")
        login_res = login(
            request=req,
            payload=LoginRequest(username_or_email="staff001_edited", password="NewTempPass456!"),
            db=db,
        )
        assert "access_token" in login_res
        assert login_res["must_change_password"] is True
        print("  [PASS] Staff logged in successfully with username. must_change_password = True.")

        # 7. Staff First Login: Change to Permanent Password
        print("\n[TEST 7] Staff First Login: Set Permanent Password")
        first_pw_res = first_login_password(
            request=req,
            payload=FirstLoginPassword(new_password="MyPrivatePermanentPass999!", confirm_password="MyPrivatePermanentPass999!"),
            user=db_member,
            db=db,
        )
        db.refresh(db_member)
        assert db_member.must_change_password is False
        assert verify_password("MyPrivatePermanentPass999!", db_member.password_hash)
        print("  [PASS] Permanent password saved. must_change_password = False.")

        # 8. Login with New Permanent Password
        print("\n[TEST 8] Login with Permanent Password")
        perm_login = login(
            request=req,
            payload=LoginRequest(username_or_email="staff001_edited", password="MyPrivatePermanentPass999!"),
            db=db,
        )
        assert perm_login["must_change_password"] is False
        print("  [PASS] Successfully logged in with permanent password directly into CRM.")

        # 9. Deactivate Account and Verify Login Blocked
        print("\n[TEST 9] Deactivate Account & Login Prevention")
        toggle_res = toggle_status(staff_id=staff_id, request=req, admin=admin, db=db)
        assert toggle_res["status"] == "inactive"
        print(f"  [PASS] Account status toggled to {toggle_res['status']}.")

        deactivated_blocked = False
        try:
            login(
                request=req,
                payload=LoginRequest(username_or_email="staff001_edited", password="MyPrivatePermanentPass999!"),
                db=db,
            )
        except Exception as e:
            deactivated_blocked = True
            print(f"  [PASS] Correctly blocked inactive account from login: {e.detail}")
        assert deactivated_blocked, "Inactive account must be blocked"

        # 10. Re-activate Account
        print("\n[TEST 10] Re-activate Account")
        reactivate_res = toggle_status(staff_id=staff_id, request=req, admin=admin, db=db)
        assert reactivate_res["status"] == "active"
        print(f"  [PASS] Account re-activated to {reactivate_res['status']}.")

        print("\n" + "=" * 65)
        print("  ALL 10 STAFF CREDENTIAL & SECURITY CHECKS PASSED PERFECTLY! [OK]")
        print("=" * 65)
        return True

    except Exception as e:
        print(f"\n  [FAIL] TEST FAILED: {e}")
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
