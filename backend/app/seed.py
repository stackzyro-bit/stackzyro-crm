"""Sample workspace generator.

All records created here are demo data. The `sample_data` setting is set to
true and the UI displays a "Sample workspace" banner so demo numbers are never
mistaken for live business data.
"""

import json
import random
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .constants import PROPOSAL_TEMPLATES
from .models import (
    Activity,
    Attendance,
    Call,
    Client,
    FollowUp,
    Lead,
    Meeting,
    Proposal,
    Service,
    Setting,
    User,
)
from .security import hash_password
from .timezone import to_utc_naive
from .utils import next_code

RANDOM = random.Random(20260411)

SERVICES = [
    ("Website Development", "website-development"),
    ("Web Application Development", "web-application-development"),
    ("Custom Software Development", "custom-software-development"),
    ("SEO Services", "seo-services"),
    ("Digital Marketing", "digital-marketing"),
    ("Social Media Management", "social-media-management"),
    ("Google Business Profile Setup", "google-business-profile-setup"),
    ("E-commerce Development", "ecommerce-development"),
]

STAFF = [
    ("Ayesha Khan", "ayesha@stackzyro.com", "Business Development Executive", "+91 98450 11223", 420),
    ("Rohan Verma", "rohan@stackzyro.com", "Sales Executive", "+91 98450 11224", 380),
    ("Sana Patel", "sana@stackzyro.com", "Digital Marketing Strategist", "+91 98450 11225", 610),
    ("Imran Sheikh", "imran@stackzyro.com", "Business Development Executive", "+91 98450 11226", 300),
    ("Neha Joshi", "neha@stackzyro.com", "Account Manager", "+91 98450 11227", 720),
    ("Karan Malhotra", "karan@stackzyro.com", "SEO Specialist", "+91 98450 11228", 490),
    ("Fatima Ali", "fatima@stackzyro.com", "Proposal Coordinator", "+91 98450 11229", 260),
    ("Dev Sharma", "dev@stackzyro.com", "Junior Sales Associate", "+91 98450 11230", 150),
]

BUSINESSES = [
    ("Bright Smile Dental Studio", "Dental Clinic", "Bengaluru", "Dr. Ritu Malhotra"),
    ("Urban Fork Kitchen", "Restaurant", "Pune", "Sameer Kulkarni"),
    ("Nestwell Interiors", "Interior Design", "Mumbai", "Priya Deshpande"),
    ("GreenLeaf Organics", "Retail", "Hyderabad", "Anil Reddy"),
    ("Skyline Realty", "Real Estate", "Gurugram", "Vikram Chauhan"),
    ("Nova Learning Academy", "Education", "Chennai", "Lakshmi Iyer"),
    ("Pulse Fitness Club", "Gym & Fitness", "Delhi", "Arjun Bhatia"),
    ("Kaveri Legal Associates", "Legal Services", "Mysuru", "Kavya Rao"),
    ("The Loom Studio", "Fashion & Apparel", "Jaipur", "Meera Rathore"),
    ("CloudNine Travels", "Travel", "Kochi", "Rahul Menon"),
    ("Aarogya Diagnostics", "Healthcare", "Nagpur", "Dr. Nitin Deshmukh"),
    ("Steelcraft Fabrication", "Manufacturing", "Coimbatore", "Suresh Kumar"),
    ("Bloom Events", "Event Management", "Goa", "Tanya Fernandes"),
    ("Saffron Spice House", "Restaurant", "Lucknow", "Amit Srivastava"),
    ("Vertex Accountants", "Financial Services", "Ahmedabad", "Hetal Shah"),
    ("Little Sprouts Preschool", "Education", "Noida", "Ritu Aggarwal"),
    ("Metro Auto Garage", "Automotive", "Indore", "Faizan Qureshi"),
    ("Serene Yoga Retreat", "Wellness", "Rishikesh", "Ananya Joshi"),
    ("Prime Insurance Advisors", "Insurance", "Chandigarh", "Manpreet Singh"),
    ("Craft & Co Furniture", "Retail", "Bengaluru", "Deepa Nair"),
    ("Infinity Web Labs", "IT Services", "Hyderabad", "Sandeep Varma"),
    ("Sunrise Bakery", "Food & Beverage", "Kolkata", "Roshni Das"),
    ("Elite Coaching Centre", "Education", "Patna", "Ravi Ranjan"),
    ("Silverline Jewellers", "Jewellery", "Surat", "Bhavesh Patel"),
    ("BlueWave Aqua Solutions", "Home Services", "Visakhapatnam", "Kiran Varma"),
    ("Hilltop Resorts", "Hospitality", "Manali", "Akshay Thakur"),
    ("Zenith Physiotherapy", "Healthcare", "Bhopal", "Dr. Shweta Jain"),
    ("Vogue Beauty Lounge", "Salon & Spa", "Mumbai", "Ritika Shetty"),
    ("Terra Farm Fresh", "AgriTech", "Nashik", "Ganesh Patil"),
    ("Orbit Digital Media", "Media", "Delhi", "Nidhi Kapoor"),
    ("SafeDrive Motors", "Automotive", "Kolkata", "Abhijit Sen"),
    ("Harmony Music School", "Education", "Pune", "Shreya Deshmukh"),
    ("Coastal Bites Cafe", "Food & Beverage", "Mangaluru", "Ryan D'Souza"),
    ("Apex Consultants", "Consulting", "Gurugram", "Kavita Menon"),
    ("PureDrop Water Solutions", "Home Services", "Rajkot", "Jayesh Mehta"),
    ("Luxe Living Spaces", "Interior Design", "Bengaluru", "Sneha Reddy"),
    ("NextGen Robotics", "Manufacturing", "Pune", "Aditya Kulkarni"),
    ("CareFirst Home Nursing", "Healthcare", "Kochi", "Mary Thomas"),
    ("StyleCraft Boutique", "Fashion & Apparel", "Ahmedabad", "Pooja Shah"),
    ("Everest Trekking Co", "Travel", "Dehradun", "Rohit Negi"),
    ("FinanceHub Advisory", "Financial Services", "Mumbai", "Kunal Mehta"),
    ("ActiveKids Play School", "Education", "Hyderabad", "Swati Rao"),
    ("Royal Caterers", "Event Management", "Jaipur", "Vishal Sharma"),
    ("PetCare Clinic", "Veterinary", "Chennai", "Dr. Divya Krishnan"),
    ("SmartBuild Infra", "Construction", "Noida", "Rajeev Bansal"),
]

STATUS_PLAN = (
    ["new"] * 8
    + ["interested"] * 12
    + ["not_interested"] * 6
    + ["accepted"] * 5
    + ["proposal_required"] * 6
    + ["converted"] * 8
)

SOURCES = ["website", "referral", "cold_call", "whatsapp", "instagram", "linkedin", "google"]

REQUIREMENTS = [
    "Needs a modern website with service pages and enquiry forms.",
    "Looking for a booking system integrated with their existing operations.",
    "Wants better local visibility and a steady flow of enquiries.",
    "Needs a proposal covering design, development and monthly maintenance.",
    "Interested in social media handling and paid campaigns.",
    "Requested a demo of similar work before finalising scope.",
]

CALL_NOTES = [
    "Spoke with the owner. They are evaluating two vendors and asked for a proposal.",
    "Number rang but was not answered. Will retry later in the day.",
    "Discussed requirements in detail. Budget is being finalised internally.",
    "Team was busy with customers. Asked us to call back next week.",
    "Very positive conversation. They want to start within this quarter.",
    "Not looking for these services right now. Asked us to reconnect next year.",
]

FOLLOWUP_NOTES = [
    "Share the revised scope document.",
    "Call back to confirm the proposal feedback.",
    "Send the meeting link and agenda.",
    "Check if the advance payment has been processed.",
    "Follow up on the design references shared on WhatsApp.",
]


def _build_content(lead: Lead, template: dict, amount: float) -> dict:
    return {
        "overview": template["overview"].format(business=lead.business_name),
        "requirements": [
            line.strip("-• ").strip()
            for line in (lead.requirements or "").splitlines()
            if line.strip()
        ],
        "scope": list(template["scope"]),
        "deliverables": list(template["deliverables"]),
        "timeline": list(template["timeline"]),
        "pricing": [
            {
                "item": template["name"],
                "description": f"For {lead.business_name}",
                "qty": 1,
                "rate": amount,
                "amount": amount,
            }
        ],
        "subtotal": amount,
        "discount": 0,
        "tax_rate": 0,
        "total": amount,
        "payment_terms": template["payment_terms"],
        "additional_costs": template["additional_costs"],
        "terms": list(template["terms"]),
        "valid_until": (date.today() + timedelta(days=30)).isoformat(),
        "client_location": lead.location or "",
        "client_email": lead.email or "",
        "client_phone": lead.phone or "",
    }


def seed_database(db: Session) -> bool:
    if db.scalar(select(func.count(User.id))):
        return False

    now = datetime.now()
    today = now.date()

    service_rows = [
        Service(name=name, slug=slug) for name, slug in SERVICES
    ]
    db.add_all(service_rows)
    db.flush()

    admin = User(
        staff_code=next_code(db, "ST"),
        name="Safana S",
        email="admin@stackzyro.com",
        phone="+91 98450 11001",
        designation="Super Admin",
        role="admin",
        password_hash=hash_password("Admin@123"),
        is_active=True,
        joined_on=today - timedelta(days=900),
    )
    db.add(admin)

    staff_hash = hash_password("Staff@123")
    staff_members: list[User] = []
    for index, (name, email, designation, phone, joined_days) in enumerate(STAFF):
        member = User(
            staff_code=next_code(db, "ST"),
            name=name,
            email=email,
            phone=phone,
            designation=designation,
            role="staff",
            password_hash=staff_hash,
            is_active=index != 7,
            joined_on=today - timedelta(days=joined_days),
        )
        db.add(member)
        staff_members.append(member)
    db.flush()

    leads: list[Lead] = []
    for index, (business, category, city, contact) in enumerate(BUSINESSES):
        status = STATUS_PLAN[index]
        assigned = staff_members[index % len(staff_members)]
        created_at = now - timedelta(
            days=RANDOM.randint(1, 56), hours=RANDOM.randint(1, 9), minutes=RANDOM.randint(0, 59)
        )
        lead = Lead(
            code=next_code(db, "LD"),
            business_name=business,
            contact_person=contact,
            phone=f"+91 9{RANDOM.randint(10000, 99999)} {RANDOM.randint(10000, 99999)}",
            email="hello@"
            + business.lower().replace(" ", "").replace("&", "").replace("'", "")[:18]
            + ".com",
            location=city,
            category=category,
            website=f"www.{business.lower().replace(' ', '')[:18]}.com",
            social_links=f"instagram.com/{business.lower().replace(' ', '')[:14]}",
            source=RANDOM.choice(SOURCES),
            requirements=RANDOM.choice(REQUIREMENTS),
            notes="Sample lead created for the demo workspace.",
            status=status,
            assigned_staff_id=assigned.id,
            created_by_id=admin.id if index % 3 == 0 else assigned.id,
            created_at=created_at,
            updated_at=created_at,
        )
        lead.services = RANDOM.sample(service_rows, k=RANDOM.choice([1, 1, 2]))
        db.add(lead)
        leads.append(lead)
    db.flush()

    active_leads = [lead for lead in leads if lead.status != "new"]
    lead_pool = [
        lead
        for lead in leads
        if lead.status in {"interested", "not_interested", "accepted", "proposal_required"}
    ]

    outcome_plan = {
        "new": ["not_taken"],
        "interested": ["interested", "interested", "call_back_requested", "not_taken"],
        "not_interested": ["not_interested", "not_interested", "not_taken"],
        "accepted": ["accepted", "interested"],
        "proposal_required": ["proposal_required", "interested", "call_back_requested"],
        "converted": ["accepted", "interested", "proposal_required"],
    }

    calls: list[Call] = []
    today_call_targets = RANDOM.sample(active_leads, k=14)
    for lead in active_leads:
        call_count = RANDOM.randint(1, 3)
        for call_index in range(call_count):
            if lead in today_call_targets and call_index == 0:
                called_at = now - timedelta(minutes=RANDOM.randint(20, 260))
            else:
                span = max((now - lead.created_at).days, 1)
                called_at = lead.created_at + timedelta(
                    days=RANDOM.randint(0, span), hours=RANDOM.randint(0, 6)
                )
                called_at = min(called_at, now - timedelta(minutes=30))
            outcome = RANDOM.choice(outcome_plan[lead.status])
            call = Call(
                code=next_code(db, "CA"),
                lead_id=lead.id,
                staff_id=lead.assigned_staff_id,
                called_at=called_at,
                outcome=outcome,
                notes=RANDOM.choice(CALL_NOTES),
                created_at=called_at,
            )
            db.add(call)
            calls.append(call)
    db.flush()

    followups: list[FollowUp] = []
    for index in range(10):
        lead = lead_pool[index % len(lead_pool)]
        due = datetime.combine(today, time(hour=9 + (index * 2) % 9, minute=30 if index % 2 else 0))
        db.add(
            FollowUp(
                code=next_code(db, "FU"),
                lead_id=lead.id,
                staff_id=lead.assigned_staff_id,
                due_at=due,
                method=RANDOM.choice(["call", "whatsapp", "email"]),
                notes=RANDOM.choice(FOLLOWUP_NOTES),
                status="pending",
                created_at=now - timedelta(days=2),
            )
        )
    for index in range(12):
        lead = RANDOM.choice(lead_pool)
        due = datetime.combine(today + timedelta(days=RANDOM.randint(1, 12)), time(hour=10 + index % 7, minute=15))
        db.add(
            FollowUp(
                code=next_code(db, "FU"),
                lead_id=lead.id,
                staff_id=lead.assigned_staff_id,
                due_at=due,
                method=RANDOM.choice(["call", "meeting", "whatsapp"]),
                notes=RANDOM.choice(FOLLOWUP_NOTES),
                status="pending",
                created_at=now - timedelta(days=1),
            )
        )
    for index in range(8):
        lead = RANDOM.choice(lead_pool)
        due = now - timedelta(days=RANDOM.randint(1, 7), hours=RANDOM.randint(0, 5))
        db.add(
            FollowUp(
                code=next_code(db, "FU"),
                lead_id=lead.id,
                staff_id=lead.assigned_staff_id,
                due_at=due,
                method=RANDOM.choice(["call", "email"]),
                notes=RANDOM.choice(FOLLOWUP_NOTES),
                status="pending",
                created_at=due - timedelta(days=3),
            )
        )
    for index in range(16):
        lead = RANDOM.choice(lead_pool)
        due = now - timedelta(days=RANDOM.randint(1, 25), hours=RANDOM.randint(0, 6))
        db.add(
            FollowUp(
                code=next_code(db, "FU"),
                lead_id=lead.id,
                staff_id=lead.assigned_staff_id,
                due_at=due,
                method=RANDOM.choice(["call", "whatsapp", "email", "visit"]),
                notes=RANDOM.choice(FOLLOWUP_NOTES),
                status="completed",
                completed_at=due + timedelta(hours=RANDOM.randint(1, 4)),
                created_at=due - timedelta(days=2),
            )
        )
    for index in range(3):
        lead = RANDOM.choice(lead_pool)
        db.add(
            FollowUp(
                code=next_code(db, "FU"),
                lead_id=lead.id,
                staff_id=lead.assigned_staff_id,
                due_at=now - timedelta(days=index + 2),
                method="call",
                notes="Cancelled after the client confirmed they are not proceeding.",
                status="cancelled",
                created_at=now - timedelta(days=6),
            )
        )
    db.flush()

    pending_by_lead: dict[int, datetime] = {}
    for followup in db.scalars(
        select(FollowUp).where(FollowUp.status == "pending").order_by(FollowUp.due_at)
    ).all():
        if followup.lead_id not in pending_by_lead:
            pending_by_lead[followup.lead_id] = followup.due_at
    for lead in leads:
        lead.next_follow_up = pending_by_lead.get(lead.id)

    proposal_leads = [
        lead for lead in leads if lead.status in {"proposal_required", "accepted", "converted"}
    ] + [lead for lead in leads if lead.status == "interested"][:3]
    proposal_statuses = [
        "draft",
        "pending_approval",
        "approved",
        "sent",
        "sent",
        "accepted",
        "rejected",
        "draft",
        "sent",
        "accepted",
        "expired",
        "pending_approval",
        "sent",
        "approved",
        "accepted",
        "draft",
        "sent",
        "accepted",
    ]
    amounts = [45000, 65000, 85000, 120000, 150000, 185000, 220000, 95000]
    for index, lead in enumerate(proposal_leads[: len(proposal_statuses)]):
        template = PROPOSAL_TEMPLATES[index % len(PROPOSAL_TEMPLATES)]
        amount = float(RANDOM.choice(amounts))
        status = proposal_statuses[index]
        created_at = now - timedelta(days=RANDOM.randint(1, 30), hours=RANDOM.randint(0, 5))
        proposal = Proposal(
            code=next_code(db, "PR"),
            lead_id=lead.id,
            client_id=None,
            title=f"{template['title']} — {lead.business_name}",
            service_type=template["service"],
            status=status,
            amount=amount,
            template_key=template["key"],
            content=json.dumps(_build_content(lead, template, amount)),
            created_by_id=lead.assigned_staff_id,
            created_at=created_at,
            updated_at=created_at,
            sent_at=created_at + timedelta(days=2)
            if status in {"sent", "accepted", "rejected", "expired"}
            else None,
            decided_at=created_at + timedelta(days=8)
            if status in {"accepted", "rejected"}
            else None,
        )
        db.add(proposal)

    meeting_leads = [lead for lead in leads if lead.status in {"interested", "accepted", "proposal_required"}]
    meeting_plan = [
        ("completed", -9, "google_meet"),
        ("completed", -5, "on_site"),
        ("rescheduled", -2, "google_meet"),
        ("cancelled", -1, "phone"),
        ("scheduled", 0, "google_meet"),
        ("scheduled", 1, "on_site"),
        ("scheduled", 2, "google_meet"),
        ("scheduled", 3, "phone"),
        ("scheduled", 5, "google_meet"),
        ("scheduled", 7, "on_site"),
        ("scheduled", 9, "google_meet"),
        ("scheduled", 12, "google_meet"),
    ]
    for index, (status, day_offset, meeting_type) in enumerate(meeting_plan):
        lead = meeting_leads[index % len(meeting_leads)]
        scheduled = datetime.combine(today + timedelta(days=day_offset), time(hour=11 + index % 6, minute=30))
        location = (
            f"https://meet.google.com/sz-{RANDOM.randint(100, 999)}-{RANDOM.randint(100, 999)}"
            if meeting_type == "google_meet"
            else ("STACKZYRO Office, Bengaluru" if meeting_type == "on_site" else lead.phone or "")
        )
        db.add(
            Meeting(
                code=next_code(db, "MT"),
                lead_id=lead.id,
                staff_id=lead.assigned_staff_id,
                scheduled_at=scheduled,
                duration_minutes=RANDOM.choice([30, 45, 60]),
                meeting_type=meeting_type,
                location=location,
                status=status,
                notes="Discovery call to understand scope and decision timeline.",
                created_at=scheduled - timedelta(days=3),
            )
        )

    clients: list[Client] = []
    project_statuses = ["in_progress", "in_progress", "completed", "on_hold", "in_progress", "completed", "in_progress", "in_progress"]
    for index, lead in enumerate([lead for lead in leads if lead.status == "converted"]):
        client = Client(
            code=next_code(db, "CT"),
            lead_id=lead.id,
            business_name=lead.business_name,
            contact_person=lead.contact_person,
            phone=lead.phone,
            email=lead.email,
            services=", ".join(service.name for service in lead.services),
            start_date=(lead.created_at + timedelta(days=6)).date(),
            project_status=project_statuses[index % len(project_statuses)],
            assigned_staff_id=lead.assigned_staff_id,
            notes="Confirmed client. Sample project created for the demo workspace.",
            created_at=lead.created_at + timedelta(days=6),
        )
        db.add(client)
        clients.append(client)
    db.flush()

    for proposal in db.scalars(select(Proposal)).all():
        lead = next((lead for lead in leads if lead.id == proposal.lead_id), None)
        if lead:
            client = next((client for client in clients if client.lead_id == lead.id), None)
            if client:
                proposal.client_id = client.id

    sunday = 6
    for offset in range(20, -1, -1):
        work_day = today - timedelta(days=offset)
        if work_day.weekday() == sunday:
            continue
        for index, member in enumerate(staff_members):
            if not member.is_active:
                continue
            roll = RANDOM.random()
            if work_day == today:
                if index == 4:
                    db.add(
                        Attendance(
                            user_id=member.id,
                            work_date=work_day,
                            status="leave",
                            note="Approved personal leave",
                        )
                    )
                    continue
                if index == 7:
                    continue
                check_in = to_utc_naive(datetime.combine(work_day, time(hour=9, minute=RANDOM.randint(30, 55))))
                check_out = (
                    None
                    if index in {1, 6}
                    else to_utc_naive(datetime.combine(work_day, time(hour=18, minute=RANDOM.randint(25, 55))))
                )
                db.add(
                    Attendance(
                        user_id=member.id,
                        work_date=work_day,
                        check_in=check_in,
                        check_out=check_out,
                        status="present",
                    )
                )
                continue
            if roll < 0.05:
                db.add(
                    Attendance(
                        user_id=member.id,
                        work_date=work_day,
                        status="leave",
                        note="Approved leave",
                    )
                )
            elif roll < 0.09:
                continue
            else:
                check_in = to_utc_naive(datetime.combine(work_day, time(hour=9, minute=RANDOM.randint(28, 58))))
                check_out = to_utc_naive(datetime.combine(work_day, time(hour=18, minute=RANDOM.randint(20, 59))))
                db.add(
                    Attendance(
                        user_id=member.id,
                        work_date=work_day,
                        check_in=check_in,
                        check_out=check_out,
                        status="present",
                    )
                )
    db.flush()

    activities: list[Activity] = []
    for lead in sorted(leads, key=lambda item: item.created_at, reverse=True)[:14]:
        activities.append(
            Activity(
                actor_id=lead.created_by_id,
                type="lead_added",
                title=f"New lead added: {lead.business_name}",
                description=f"{lead.code} · {lead.category}",
                entity_type="lead",
                entity_id=lead.id,
                created_at=lead.created_at,
            )
        )
    for call in sorted(calls, key=lambda item: item.called_at, reverse=True)[:10]:
        lead = next((lead for lead in leads if lead.id == call.lead_id), None)
        activities.append(
            Activity(
                actor_id=call.staff_id,
                type="call_completed",
                title=f"Call completed with {lead.business_name if lead else 'lead'}",
                description=f"{call.code} · Outcome: {call.outcome.replace('_', ' ')}",
                entity_type="call",
                entity_id=lead.id if lead else None,
                created_at=call.called_at,
            )
        )
    for proposal in sorted(
        db.scalars(select(Proposal)).all(), key=lambda item: item.created_at, reverse=True
    )[:6]:
        lead = next((lead for lead in leads if lead.id == proposal.lead_id), None)
        activities.append(
            Activity(
                actor_id=proposal.created_by_id,
                type="proposal_sent" if proposal.sent_at else "proposal_created",
                title=(
                    f"Proposal sent to {lead.business_name}"
                    if proposal.sent_at and lead
                    else f"Proposal drafted for {lead.business_name if lead else 'client'}"
                ),
                description=f"{proposal.code} · {proposal.title}",
                entity_type="proposal",
                entity_id=proposal.id,
                created_at=proposal.sent_at or proposal.created_at,
            )
        )
    for client in clients[-4:]:
        activities.append(
            Activity(
                actor_id=client.assigned_staff_id,
                type="client_converted",
                title=f"{client.business_name} converted to client",
                description=f"{client.code} · {client.services}",
                entity_type="client",
                entity_id=client.id,
                created_at=client.created_at,
            )
        )
    for activity in activities:
        if activity.created_at > now:
            activity.created_at = now - timedelta(hours=RANDOM.randint(1, 5))
    db.add_all(activities)

    db.add_all(
        [
            Setting(key="sample_data", value="true"),
            Setting(key="company_name", value="STACKZYRO"),
            Setting(key="company_tagline", value="Turning Ideas Into Digital Solutions"),
            Setting(
                key="staff_permissions",
                value=json.dumps(
                    [
                        "create_leads",
                        "record_calls",
                        "manage_followups",
                        "create_proposals",
                        "schedule_meetings",
                        "view_clients",
                    ]
                ),
            ),
        ]
    )
    db.commit()
    return True


def seed_if_empty(db: Session) -> None:
    created = seed_database(db)
    if created:
        print("Seeded sample workspace (admin@stackzyro.com / Admin@123)")


if __name__ == "__main__":
    import sys

    from .database import Base, SessionLocal, engine

    Base.metadata.create_all(bind=engine)
    if "--reset" in sys.argv:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print("Dropped and recreated all tables.")
    with SessionLocal() as session:
        result = seed_database(session)
        print("Sample data seeded." if result else "Database already contains data — skipped.")
