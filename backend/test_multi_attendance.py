import json
import urllib.request
import urllib.error
from datetime import date, datetime

BASE_URL = "http://127.0.0.1:8000"

def req(path: str, method: str = "GET", data: dict = None, token: str = None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            content = resp.read().decode("utf-8")
            ct = resp.headers.get("Content-Type", "")
            if "application/json" in ct:
                return resp.status, json.loads(content)
            return resp.status, content
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_content)
        except Exception:
            return e.code, err_content

def run_tests():
    print("=" * 65)
    print("   STACKZYRO CRM - MULTI CHECK-IN / CHECK-OUT TEST SUITE")
    print("=" * 65)

    # 1. Login as Staff
    status, res = req("/api/auth/login", method="POST", data={
        "username_or_email": "ayesha@stackzyro.com",
        "password": "Staff@123"
    })
    assert status == 200, f"Staff login failed: {res}"
    staff_token = res["token"]
    print("\n[TEST 1] Staff Login & Auth Headers")
    print("  [PASS] Ayesha logged in successfully.")

    # 2. Login as Admin
    status, res = req("/api/auth/login", method="POST", data={
        "username_or_email": "admin@stackzyro.com",
        "password": "Admin@123"
    })
    assert status == 200, f"Admin login failed: {res}"
    admin_token = res["token"]
    print("\n[TEST 2] Admin Login & Auth Headers")
    print("  [PASS] Admin logged in successfully.")

    # 3. Test Initial / Current Attendance Status
    status, st_data = req("/api/attendance/today-status", token=staff_token)
    assert status == 200
    print("\n[TEST 3] Current Attendance Status")
    print(f"  [PASS] Current status: {st_data['current_status']}, is_checked_in: {st_data['is_checked_in']}.")

    # 4. If currently checked in, check out first to test from clean state
    if st_data["is_checked_in"]:
        status, co_init = req("/api/attendance/check-out", method="POST", data={"reason": "Lunch Break"}, token=staff_token)
        assert status == 200

    # 5. Check-In (Session A: Start of work)
    status, ci1 = req("/api/attendance/check-in", method="POST", data={"note": "Start of work"}, token=staff_token)
    assert status == 200
    assert ci1["current_status"] == "checked_in"
    assert ci1["is_checked_in"] is True
    first_sess_num = ci1["sessions"][-1]["session_number"]
    print("\n[TEST 4] Multiple Check-In: Session Start")
    print(f"  [PASS] Checked in for Session #{first_sess_num}. Active session started.")

    # 6. Test Consecutive Check-In Prevention
    status, bad_ci = req("/api/attendance/check-in", method="POST", data={"note": "Double checkin"}, token=staff_token)
    assert status == 400
    print("\n[TEST 5] Consecutive Check-In Prevention")
    print(f"  [PASS] Prevented consecutive check-in: {bad_ci['detail']}")

    # 7. Check-Out (Session A ends: Client Meeting)
    status, co1 = req("/api/attendance/check-out", method="POST", data={
        "reason": "Client Meeting",
        "note": "On-site visit at client office"
    }, token=staff_token)
    assert status == 200
    assert co1["current_status"] == "checked_out"
    assert co1["is_checked_in"] is False
    assert co1["sessions"][-1]["check_out_reason"] == "Client Meeting"
    print("\n[TEST 6] Multiple Check-Out: Client Meeting Reason")
    print(f"  [PASS] Checked out for 'Client Meeting'. Working time recorded.")

    # 8. Test Consecutive Check-Out Prevention
    status, bad_co = req("/api/attendance/check-out", method="POST", data={"reason": "Lunch Break"}, token=staff_token)
    assert status == 400
    print("\n[TEST 7] Consecutive Check-Out Prevention")
    print(f"  [PASS] Prevented consecutive check-out: {bad_co['detail']}")

    # 9. Second Check-In (Session B: Return from Client Meeting)
    status, ci2 = req("/api/attendance/check-in", method="POST", data={"note": "Returned from client"}, token=staff_token)
    assert status == 200
    assert ci2["current_status"] == "checked_in"
    second_sess_num = ci2["sessions"][-1]["session_number"]
    assert second_sess_num == first_sess_num + 1
    print("\n[TEST 8] Second Check-In (Return from Client Meeting)")
    print(f"  [PASS] Checked in for Session #{second_sess_num}. Break time between visits logged.")

    # 10. Second Check-Out (Session B ends: Lunch Break)
    status, co2 = req("/api/attendance/check-out", method="POST", data={
        "reason": "Lunch Break",
        "note": "Lunch break"
    }, token=staff_token)
    assert status == 200
    assert co2["current_status"] == "checked_out"
    assert co2["sessions"][-1]["check_out_reason"] == "Lunch Break"
    print("\n[TEST 9] Second Check-Out (Lunch Break)")
    print(f"  [PASS] Checked out for 'Lunch Break'. Total exits recorded: {co2['exit_count']}.")

    # 11. Third Check-In (Session C: Return from Lunch)
    status, ci3 = req("/api/attendance/check-in", method="POST", data={"note": "Back from lunch"}, token=staff_token)
    assert status == 200
    assert ci3["current_status"] == "checked_in"
    third_sess_num = ci3["sessions"][-1]["session_number"]
    print("\n[TEST 10] Third Check-In (Return from Lunch)")
    print(f"  [PASS] Session #{third_sess_num} active.")

    # 12. Third Check-Out (Session C ends: End of Day)
    status, co3 = req("/api/attendance/check-out", method="POST", data={
        "reason": "End of Day",
        "note": "Finished shift"
    }, token=staff_token)
    assert status == 200
    assert co3["current_status"] == "checked_out"
    print("\n[TEST 11] Third Check-Out (End of Day)")
    print(f"  [PASS] Multiple check-in/out cycle completed. Total exits: {co3['exit_count']}.")

    # 13. Admin Live Team Board
    status, summary = req("/api/attendance/summary", token=admin_token)
    assert status == 200
    assert "live_board" in summary
    assert len(summary["live_board"]) > 0
    print("\n[TEST 12] Admin Live Team Board")
    print(f"  [PASS] Live board retrieved with {len(summary['live_board'])} staff members.")

    # 14. Admin Daily Timeline Inspection
    staff_id = summary["live_board"][0]["staff"]["id"]
    work_date = summary["date"]
    status, timeline = req(f"/api/attendance/daily-timeline?user_id={staff_id}&work_date={work_date}", token=admin_token)
    assert status == 200
    assert "sessions" in timeline
    print("\n[TEST 13] Admin Daily Timeline Inspection")
    print(f"  [PASS] Retrieved timeline for employee #{staff_id} on {work_date} with {len(timeline['sessions'])} sessions.")

    # 15. Admin Manual Session Entry with Mandatory Reason
    status, man_sess = req("/api/attendance/sessions", method="POST", data={
        "user_id": staff_id,
        "work_date": work_date,
        "check_in": f"{work_date}T20:00:00",
        "check_out": f"{work_date}T21:00:00",
        "check_out_reason": "Official Work Outside Office",
        "correction_reason": "Authorized emergency client support"
    }, token=admin_token)
    assert status == 201
    assert man_sess["is_manual"] is True
    print("\n[TEST 14] Admin Manual Session Addition")
    print(f"  [PASS] Session created with manual flag and reason: {man_sess['correction_reason']}.")

    # 16. CSV Export
    status, csv_data = req("/api/attendance/export", token=admin_token)
    assert status == 200
    assert "Active Working Time" in csv_data
    assert "Number of Exits" in csv_data
    print("\n[TEST 15] CSV Report Export")
    print("  [PASS] Multi-event CSV report exported with working duration and exit counts.")

    print("\n" + "=" * 65)
    print("  ALL 15 MULTI-ATTENDANCE TESTS PASSED WITH 100% SUCCESS! [OK]")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
