"""Regression tests for meeting scheduling timezone handling (Asia/Kolkata).

Runs the real router functions against a throwaway SQLite file so production
data is never touched. Run with:

    ./.venv/Scripts/python.exe test_meeting_timezone_fix.py
"""

import os
import tempfile
import traceback
from datetime import datetime
from pathlib import Path

TMP_DB = Path(tempfile.gettempdir()) / "stackzyro_meeting_tz_test.db"
if TMP_DB.exists():
    TMP_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TMP_DB.as_posix()}"
os.environ["SEED_SAMPLE_DATA"] = "false"

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import Lead, User  # noqa: E402
from app.routers.meetings import create_meeting, list_meetings, update_meeting  # noqa: E402
from app.schemas import MeetingCreate, MeetingUpdate  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.timezone import IST  # noqa: E402

PASSED = 0
FAILED = 0


def check(label: str, condition: bool, detail: str = "") -> None:
    global PASSED, FAILED
    if condition:
        PASSED += 1
        print(f"  [PASS] {label}")
    else:
        FAILED += 1
        print(f"  [FAIL] {label} {detail}")


def ist_of(api_timestamp: str) -> datetime:
    """Convert an API (UTC ISO-8601 'Z') timestamp into Asia/Kolkata time."""
    return datetime.fromisoformat(api_timestamp.replace("Z", "+00:00")).astimezone(IST)


def main() -> int:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin = User(
            staff_code="ST-0001",
            username="admin",
            name="Admin",
            email="admin@test.local",
            role="admin",
            status="active",
            password_hash=hash_password("Admin@123"),
            is_active=True,
        )
        lead = Lead(code="LD-0001", business_name="Test Business", status="new")
        db.add_all([admin, lead])
        db.commit()
        db.refresh(admin)
        db.refresh(lead)

        print("\n[1] Create a meeting at 10:30 AM IST")
        created = create_meeting(
            MeetingCreate(
                lead_id=lead.id,
                scheduled_at="2026-11-30T10:30:00+05:30",
                duration_minutes=45,
            ),
            user=admin,
            db=db,
        )
        check(
            "API returns UTC instant 2026-11-30T05:00:00Z",
            created["scheduled_at"] == "2026-11-30T05:00:00Z",
            created["scheduled_at"],
        )
        check(
            "Rendered in IST it is 10:30",
            ist_of(created["scheduled_at"]).strftime("%H:%M") == "10:30",
            ist_of(created["scheduled_at"]).isoformat(),
        )

        from app.models import Meeting  # local import to read raw storage

        row = db.get(Meeting, created["id"])
        check(
            "Database stores naive UTC 2026-11-30 05:00",
            row.scheduled_at == datetime(2026, 11, 30, 5, 0),
            str(row.scheduled_at),
        )
        check("Duration persisted", row.duration_minutes == 45, str(row.duration_minutes))
        check("Lead persisted", row.lead_id == lead.id, str(row.lead_id))

        print("\n[2] Edit without changing the time")
        updated = update_meeting(
            created["id"],
            MeetingUpdate(
                scheduled_at="2026-11-30T10:30:00+05:30",
                duration_minutes=45,
                meeting_type="google_meet",
                notes="No time change",
            ),
            user=admin,
            db=db,
        )
        check(
            "Time still renders as 10:30 IST",
            ist_of(updated["scheduled_at"]).strftime("%H:%M") == "10:30",
            updated["scheduled_at"],
        )
        check(
            "No drift after save (05:00Z)",
            updated["scheduled_at"] == "2026-11-30T05:00:00Z",
            updated["scheduled_at"],
        )
        check("Notes saved", updated["notes"] == "No time change", str(updated["notes"]))

        print("\n[3] Change the time to 2:45 PM and save")
        updated = update_meeting(
            created["id"],
            MeetingUpdate(scheduled_at="2026-11-30T14:45:00+05:30"),
            user=admin,
            db=db,
        )
        check(
            "Stored as 09:15Z (14:45 IST - 05:30)",
            updated["scheduled_at"] == "2026-11-30T09:15:00Z",
            updated["scheduled_at"],
        )
        check(
            "Displays 14:45 IST",
            ist_of(updated["scheduled_at"]).strftime("%H:%M") == "14:45",
            ist_of(updated["scheduled_at"]).isoformat(),
        )
        check(
            "Date unchanged by a time-only edit",
            ist_of(updated["scheduled_at"]).date().isoformat() == "2026-11-30",
            ist_of(updated["scheduled_at"]).date().isoformat(),
        )

        print("\n[4] Change only the date (time must be preserved)")
        updated = update_meeting(
            created["id"],
            MeetingUpdate(scheduled_at="2026-12-02T14:45:00+05:30"),
            user=admin,
            db=db,
        )
        check(
            "New date in IST is 2026-12-02",
            ist_of(updated["scheduled_at"]).date().isoformat() == "2026-12-02",
            ist_of(updated["scheduled_at"]).isoformat(),
        )
        check(
            "Time still 14:45 IST",
            ist_of(updated["scheduled_at"]).strftime("%H:%M") == "14:45",
            ist_of(updated["scheduled_at"]).isoformat(),
        )

        print("\n[5] Status-only update keeps date and time")
        updated = update_meeting(
            created["id"], MeetingUpdate(status="rescheduled"), user=admin, db=db
        )
        check("Status updated", updated["status"] == "rescheduled", updated["status"])
        check(
            "Date/time untouched (09:15Z on 2026-12-02)",
            updated["scheduled_at"] == "2026-12-02T09:15:00Z",
            updated["scheduled_at"],
        )

        print("\n[6] Meeting list returns the same instant")
        listing = list_meetings(
            q=None,
            status=None,
            staff_id=None,
            date_from=None,
            date_to=None,
            page=1,
            page_size=10,
            user=admin,
            db=db,
        )
        item = next(m for m in listing["items"] if m["id"] == created["id"])
        check(
            "List shows 14:45 IST on 02 Dec 2026",
            ist_of(item["scheduled_at"]).isoformat().startswith("2026-12-02T14:45"),
            item["scheduled_at"],
        )

        print("\n[7] IST date filters include the meeting on its IST day")
        listing = list_meetings(
            q=None,
            status=None,
            staff_id=None,
            date_from="2026-12-02",
            date_to="2026-12-02",
            page=1,
            page_size=10,
            user=admin,
            db=db,
        )
        check(
            "date_from/date_to 2026-12-02 finds it",
            any(m["id"] == created["id"] for m in listing["items"]),
            f"total={listing['total']}",
        )
        listing = list_meetings(
            q=None,
            status=None,
            staff_id=None,
            date_from="2026-12-03",
            date_to="2026-12-03",
            page=1,
            page_size=10,
            user=admin,
            db=db,
        )
        check(
            "Next IST day does not include it",
            all(m["id"] != created["id"] for m in listing["items"]),
            f"total={listing['total']}",
        )

        print("\n[8] A late-evening IST meeting keeps its IST calendar date")
        evening = create_meeting(
            MeetingCreate(lead_id=lead.id, scheduled_at="2026-12-05T23:30:00+05:30"),
            user=admin,
            db=db,
        )
        check(
            "23:30 IST stored as 18:00Z",
            evening["scheduled_at"] == "2026-12-05T18:00:00Z",
            evening["scheduled_at"],
        )
        check(
            "Still 05 Dec 2026 23:30 in IST",
            ist_of(evening["scheduled_at"]).isoformat().startswith("2026-12-05T23:30"),
            ist_of(evening["scheduled_at"]).isoformat(),
        )

        print("\n[9] Naive input (no offset) is treated as IST, not UTC")
        naive = create_meeting(
            MeetingCreate(lead_id=lead.id, scheduled_at="2026-12-06T10:30:00"),
            user=admin,
            db=db,
        )
        check(
            "10:30 naive -> 05:00Z",
            naive["scheduled_at"] == "2026-12-06T05:00:00Z",
            naive["scheduled_at"],
        )
        check(
            "Renders 10:30 IST",
            ist_of(naive["scheduled_at"]).strftime("%H:%M") == "10:30",
            ist_of(naive["scheduled_at"]).isoformat(),
        )

        print("\n[10] Midnight IST is not shifted to the previous day")
        midnight = create_meeting(
            MeetingCreate(lead_id=lead.id, scheduled_at="2026-12-07T00:00:00+05:30"),
            user=admin,
            db=db,
        )
        check(
            "00:00 IST stored as 18:30Z on the previous UTC day",
            midnight["scheduled_at"] == "2026-12-06T18:30:00Z",
            midnight["scheduled_at"],
        )
        check(
            "Renders as 07 Dec 00:00 IST",
            ist_of(midnight["scheduled_at"]).isoformat().startswith("2026-12-07T00:00"),
            ist_of(midnight["scheduled_at"]).isoformat(),
        )

        print("\n" + "=" * 60)
        print(f"RESULT: {PASSED} passed, {FAILED} failed")
        print("=" * 60)
        return 0 if FAILED == 0 else 1
    except Exception as exc:  # pragma: no cover
        traceback.print_exc()
        print(f"UNEXPECTED FAILURE: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
