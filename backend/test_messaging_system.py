import os
import sys

# Ensure backend directory is in python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import Base, SessionLocal, engine
from app.migrations import apply_migrations
from app.seed import seed_if_empty
from app.models import User, Conversation, Message, MessageReceipt
from app.schemas import ConversationCreate, MessageReply, ConversationUpdate
from app.routers.messages import (
    list_recipients,
    get_unread_count,
    list_announcements,
    create_conversation,
    list_conversations,
    get_conversation,
    reply_conversation,
    update_conversation,
    delete_conversation,
)
from fastapi import HTTPException

def run_messaging_tests():
    print("=" * 70)
    print("   STACKZYRO CRM - INTERNAL MESSAGING & ANNOUNCEMENT TEST SUITE")
    print("=" * 70)

    # 1. Initialize DB and apply migrations
    Base.metadata.create_all(bind=engine)
    apply_migrations()

    db = SessionLocal()
    seed_if_empty(db)

    try:
        # Retrieve Admin and Staff accounts
        admin = db.query(User).filter(User.role == "admin").first()
        assert admin is not None, "Admin user must exist"

        staff1 = db.query(User).filter(User.role == "staff", User.is_active.is_(True)).first()
        assert staff1 is not None, "Staff 1 user must exist"

        staff2 = db.query(User).filter(User.role == "staff", User.id != staff1.id, User.is_active.is_(True)).first()
        if not staff2:
            staff2 = User(
                name="Vikram Patel",
                email="vikram@stackzyro.com",
                username="vikram_p",
                role="staff",
                designation="Sales Executive",
                status="active",
                is_active=True,
                password_hash=staff1.password_hash,
                permissions=staff1.permissions,
            )
            db.add(staff2)
            db.commit()
            db.refresh(staff2)

        print("\n[TEST 1] Eligible Recipient Rules")
        # Staff can only message Admin
        staff_recipients = list_recipients(user=staff1, db=db)
        assert len(staff_recipients) > 0
        assert all(r["role"] == "admin" for r in staff_recipients), "Staff must only see admins"
        print(f"  [PASS] Staff 1 can only message admin(s): {[r['name'] for r in staff_recipients]}")

        # Admin can message all staff
        admin_recipients = list_recipients(user=admin, db=db)
        assert len(admin_recipients) >= 2
        assert all(r["role"] == "staff" for r in admin_recipients), "Admin sees all active staff"
        print(f"  [PASS] Admin can message all staff: {[r['name'] for r in admin_recipients]}")

        print("\n[TEST 2] Admin Broadcasts Pinned Announcement to All Staff")
        ann_payload = ConversationCreate(
            subject="Q4 Strategy & Performance Targets",
            content="Welcome team. All sales executives must submit proposals by 5 PM.",
            category="important_notice",
            priority="important",
            is_announcement=True,
            is_pinned=True,
            target_audience="all_staff",
            recipient_ids=[],
        )
        ann_conv = create_conversation(payload=ann_payload, user=admin, db=db)
        assert ann_conv["is_announcement"] is True
        assert ann_conv["is_pinned"] is True
        assert ann_conv["code"].startswith("MSG-")
        conv_id = ann_conv["id"]
        print(f"  [PASS] Announcement created: {ann_conv['code']} - '{ann_conv['subject']}'")

        print("\n[TEST 3] Announcements Widget Feed for Staff")
        ann_feed = list_announcements(user=staff1, db=db)
        assert len(ann_feed["items"]) > 0
        assert any(item["id"] == conv_id for item in ann_feed["items"])
        print(f"  [PASS] Announcement visible in staff dashboard widget (Total active: {len(ann_feed['items'])})")

        print("\n[TEST 4] Unread Counters for Staff")
        unread_before = get_unread_count(user=staff1, db=db)
        assert unread_before["total_unread"] >= 1
        assert unread_before["unread_announcements"] >= 1
        print(f"  [PASS] Staff unread count updated: {unread_before['total_unread']} unread (Announcements: {unread_before['unread_announcements']})")

        print("\n[TEST 5] Staff Opens Conversation Thread & Auto Marks as Read")
        thread = get_conversation(conversation_id=conv_id, user=staff1, db=db)
        assert thread["id"] == conv_id
        assert len(thread["messages"]) >= 1
        assert thread["unread_count"] == 0
        unread_after = get_unread_count(user=staff1, db=db)
        assert unread_after["unread_announcements"] < unread_before["unread_announcements"] or unread_after["unread_announcements"] == 0
        print("  [PASS] Opening conversation thread automatically generated read receipt")

        print("\n[TEST 6] Staff Two-Way Reply to Announcement")
        reply_payload = MessageReply(
            content="Understood! Target proposals will be uploaded before the deadline.",
        )
        reply_res = reply_conversation(conversation_id=conv_id, payload=reply_payload, user=staff1, db=db)
        assert len(reply_res["messages"]) == 2
        assert reply_res["messages"][-1]["sender"]["id"] == staff1.id
        print(f"  [PASS] Staff replied to thread (Total messages: {len(reply_res['messages'])})")

        print("\n[TEST 7] Admin Receives Reply in Thread")
        admin_thread = get_conversation(conversation_id=conv_id, user=admin, db=db)
        assert len(admin_thread["messages"]) == 2
        print(f"  [PASS] Admin read staff reply: '{admin_thread['messages'][-1]['content']}'")

        print("\n[TEST 8] Staff Direct Message to Admin (Client Issue Query)")
        dm_payload = ConversationCreate(
            subject="Client Lead Issue - Vertex follow-up needed",
            content="Client requested custom discount approval on hospital management system.",
            category="client_issue",
            priority="urgent",
            is_announcement=False,
            is_pinned=False,
            target_audience="direct",
            recipient_ids=[admin.id],
        )
        dm_res = create_conversation(payload=dm_payload, user=staff1, db=db)
        dm_id = dm_res["id"]
        assert dm_res["code"].startswith("MSG-")
        assert dm_res["priority"] == "urgent"
        print(f"  [PASS] Staff 1 created urgent direct conversation: {dm_res['code']} with Admin")

        print("\n[TEST 9] Privacy & Security Isolation Check (Staff 2 vs Staff 1)")
        # Staff 2 MUST be rejected with HTTP 403 when trying to access Staff 1's private conversation
        access_blocked = False
        try:
            get_conversation(conversation_id=dm_id, user=staff2, db=db)
        except HTTPException as he:
            if he.status_code == 403:
                access_blocked = True
        assert access_blocked is True, "Security violation: Staff 2 must NOT access Staff 1's conversation"
        print("  [PASS] Security confirmed: Staff 2 receives HTTP 403 Forbidden for Staff 1's private message")

        print("\n[TEST 10] Admin Pin and Archive Management")
        # Admin unpins announcement
        unpinned = update_conversation(conversation_id=conv_id, payload=ConversationUpdate(is_pinned=False), user=admin, db=db)
        assert unpinned["is_pinned"] is False
        print("  [PASS] Admin unpinned announcement successfully")

        # Staff archives conversation in their personal mailbox
        archived = update_conversation(conversation_id=conv_id, payload=ConversationUpdate(is_archived=True), user=staff1, db=db)
        print("  [PASS] Staff archived conversation in personal view")

        # Verify folder filtering
        archived_list = list_conversations(folder="archived", user=staff1, db=db)
        assert any(c["id"] == conv_id for c in archived_list["items"])
        print(f"  [PASS] Conversation listed in staff archived folder (Total: {archived_list['total']})")

        print("\n[TEST 11] Clean-up and Conversation Deletion (Admin Only)")
        del_res = delete_conversation(conversation_id=dm_id, user=admin, db=db)
        assert del_res["message"] == "Conversation deleted."
        print("  [PASS] Admin deleted direct test conversation")

        print("\n" + "=" * 70)
        print("   ALL 11 MESSAGING & ANNOUNCEMENT TESTS PASSED PERFECTLY!")
        print("=" * 70)

    finally:
        db.close()

if __name__ == "__main__":
    run_messaging_tests()
