import sys
import traceback
from datetime import date, datetime
from app.database import SessionLocal
from app.models import User, Attendance, AttendanceSession
from app.routers.attendance import (
    get_today_status,
    check_in,
    check_out,
    list_attendance,
)
from app.schemas import CheckInPayload, CheckOutPayload

def run_attendance_tests():
    print("=" * 65)
    print("   ATTENDANCE MULTI-CHECK-IN/OUT - AUTOMATED TEST SUITE")
    print("=" * 65)

    db = SessionLocal()
    try:
        staff = db.query(User).filter(User.email == "ayesha@stackzyro.com").first()
        admin = db.query(User).filter(User.email == "admin@stackzyro.com").first()
        assert staff is not None
        assert admin is not None

        # 1. Today status
        print("\n[TEST 1] Initial Status Check")
        st = get_today_status(user=staff, db=db)
        print(f"  [PASS] Status: {st['current_status']}, is_checked_in: {st['is_checked_in']}")

        # If checked in, check out first
        if st["is_checked_in"]:
            check_out(payload=CheckOutPayload(reason="Previous Session Wrapup"), user=staff, db=db)
            st = get_today_status(user=staff, db=db)
            assert not st["is_checked_in"]

        # 2. Check In Event 1
        print("\n[TEST 2] First Check-In Event")
        in_res = check_in(payload=CheckInPayload(note="Morning Shift Start"), user=staff, db=db)
        print(f"  [PASS] Checked in successfully: status: {in_res.get('current_status')}, is_checked_in: {in_res.get('is_checked_in')}")

        st = get_today_status(user=staff, db=db)
        assert st["is_checked_in"] is True
        assert st["current_status"] == "checked_in"

        # 3. Duplicate Check In Rejection
        print("\n[TEST 3] Duplicate Check-In Protection")
        dup_failed = False
        try:
            check_in(payload=CheckInPayload(note="Duplicate click"), user=staff, db=db)
        except Exception as e:
            dup_failed = True
            print(f"  [PASS] Properly rejected duplicate check-in: {e}")
        assert dup_failed, "Duplicate check-in should have thrown 400"

        # 4. Check Out Event 1 (Lunch break)
        print("\n[TEST 4] First Check-Out Event (Lunch Break)")
        out_res = check_out(payload=CheckOutPayload(reason="Lunch Break", note="30 min break"), user=staff, db=db)
        print(f"  [PASS] Checked out successfully: status: {out_res.get('current_status')}")

        st = get_today_status(user=staff, db=db)
        assert st["is_checked_in"] is False
        assert st["current_status"] == "checked_out"

        # 5. Duplicate Check Out Rejection
        print("\n[TEST 5] Duplicate Check-Out Protection")
        dup_out_failed = False
        try:
            check_out(payload=CheckOutPayload(reason="Double checkout"), user=staff, db=db)
        except Exception as e:
            dup_out_failed = True
            print(f"  [PASS] Properly rejected duplicate check-out: {e}")
        assert dup_out_failed, "Duplicate check-out should have thrown 400"

        # 6. Check In Event 2 (Multiple event support)
        print("\n[TEST 6] Second Check-In Event (Afternoon Session)")
        in2_res = check_in(payload=CheckInPayload(note="Resuming after lunch"), user=staff, db=db)
        print(f"  [PASS] Second check-in succeeded: status: {in2_res.get('current_status')}")

        st = get_today_status(user=staff, db=db)
        assert st["is_checked_in"] is True
        assert st["current_status"] == "checked_in"

        # 7. Final Check Out Event 2 (End of Day)
        print("\n[TEST 7] Final Check-Out Event (End of Day)")
        out2_res = check_out(payload=CheckOutPayload(reason="End of Day", note="Tasks done"), user=staff, db=db)
        print(f"  [PASS] Final check-out succeeded: status: {out2_res.get('current_status')}")

        st = get_today_status(user=staff, db=db)
        assert st["is_checked_in"] is False
        assert st["current_status"] == "checked_out"

        # 8. Admin View & Calculations
        print("\n[TEST 8] Admin Attendance View & Duration Calculation")
        att_list = list_attendance(work_date=str(date.today()), user=admin, db=db)
        assert len(att_list["items"]) > 0
        staff_att = next((a for a in att_list["items"] if a.get("user_id") == staff.id or (a.get("staff") and a["staff"]["id"] == staff.id)), None)
        assert staff_att is not None
        print(f"  [PASS] Admin verified attendance record for {staff.name}: {len(staff_att.get('sessions', []))} sessions recorded today.")
        for s in staff_att.get("sessions", []):
            print(f"       Session #{s['id']}: in={s['check_in']} | out={s['check_out']} ({s.get('check_out_reason')}) | duration={s.get('working_seconds', 0)//60} mins")

        print("\n" + "=" * 65)
        print("  ALL ATTENDANCE MULTI-CHECK-IN TESTS PASSED PERFECTLY! [OK]")
        print("=" * 65)
        return True

    except Exception as e:
        print(f"\n  [FAIL] TEST FAILED: {e}")
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = run_attendance_tests()
    sys.exit(0 if success else 1)
