LEAD_STATUSES = [
    "new",
    "interested",
    "not_interested",
    "accepted",
    "proposal_required",
    "converted",
]

CALL_OUTCOMES = [
    "interested",
    "not_interested",
    "not_taken",
    "call_back_requested",
    "accepted",
    "proposal_required",
    "do_not_contact",
]

FOLLOWUP_METHODS = ["call", "whatsapp", "email", "meeting", "visit"]
FOLLOWUP_STATUSES = ["pending", "completed", "cancelled"]

PROPOSAL_STATUSES = [
    "draft",
    "pending_approval",
    "approved",
    "sent",
    "accepted",
    "rejected",
    "expired",
]

PROJECT_STATUSES = ["in_progress", "on_hold", "completed", "cancelled"]

MEETING_TYPES = ["google_meet", "on_site", "phone"]
MEETING_STATUSES = ["scheduled", "completed", "rescheduled", "cancelled"]

ATTENDANCE_STATUSES = ["present", "absent", "leave", "half_day"]

MESSAGE_PRIORITIES = ["normal", "important", "urgent"]

ADMIN_MESSAGE_CATEGORIES = [
    {"key": "announcement", "label": "General Announcement"},
    {"key": "notice", "label": "Important Notice"},
    {"key": "work_instructions", "label": "Work Instructions"},
    {"key": "meeting_notice", "label": "Meeting Notice"},
    {"key": "training_update", "label": "Training Update"},
    {"key": "attendance_reminder", "label": "Attendance Reminder"},
    {"key": "task_assignment", "label": "Task Assignment"},
    {"key": "urgent_notice", "label": "Urgent Notice"},
    {"key": "direct_message", "label": "Direct Message"},
]

STAFF_MESSAGE_CATEGORIES = [
    {"key": "general_query", "label": "General Query"},
    {"key": "work_update", "label": "Work Update"},
    {"key": "client_lead_issue", "label": "Client / Lead Issue"},
    {"key": "technical_problem", "label": "Technical Problem"},
    {"key": "attendance_correction", "label": "Attendance Correction Request"},
    {"key": "leave_request", "label": "Leave or Permission Request"},
    {"key": "other", "label": "Other Inquiry"},
]

CHECK_OUT_REASONS = [
    "Lunch Break",
    "Tea / Personal Break",
    "Client Meeting",
    "Business Visit",
    "Official Work Outside Office",
    "Personal Work",
    "End of Day",
    "Other",
]

LEAD_SOURCES = [
    "website",
    "referral",
    "cold_call",
    "whatsapp",
    "instagram",
    "linkedin",
    "google",
    "walk_in",
    "event",
    "other",
]

STAFF_PERMISSIONS = [
    "create_leads",
    "record_calls",
    "manage_followups",
    "create_proposals",
    "schedule_meetings",
    "view_clients",
]

CRM_MODULES = [
    {"key": "dashboard", "label": "Dashboard", "actions": ["view"]},
    {"key": "leads", "label": "Leads", "actions": ["view", "create", "edit", "delete", "export", "assign"]},
    {"key": "calls", "label": "Call Management", "actions": ["view", "create", "edit", "delete", "export"]},
    {"key": "followups", "label": "Follow-ups", "actions": ["view", "create", "edit", "delete"]},
    {"key": "proposals", "label": "Proposals", "actions": ["view", "create", "edit", "delete", "export", "approve"]},
    {"key": "meetings", "label": "Meetings", "actions": ["view", "create", "edit", "delete"]},
    {"key": "clients", "label": "Clients", "actions": ["view", "create", "edit", "delete", "export"]},
    {"key": "attendance", "label": "Attendance", "actions": ["view", "create", "edit", "export"]},
    {"key": "staff", "label": "Staff Management", "actions": ["view", "create", "edit", "delete", "export"]},
    {"key": "messages", "label": "Internal Messages", "actions": ["view", "create", "edit", "delete", "broadcast"]},
    {"key": "reports", "label": "Reports", "actions": ["view", "export"]},
    {"key": "settings", "label": "Settings", "actions": ["view", "edit"]},
    {"key": "audit_logs", "label": "Audit Logs", "actions": ["view", "export"]},
]

DEFAULT_STAFF_PERMISSIONS = {
    "dashboard": ["view"],
    "leads": ["view", "create", "edit"],
    "calls": ["view", "create"],
    "followups": ["view", "create", "edit"],
    "proposals": ["view", "create"],
    "meetings": ["view", "create"],
    "clients": ["view"],
    "attendance": ["view", "create"],
    "messages": ["view", "create"],
    "staff": [],
    "reports": [],
    "settings": [],
    "audit_logs": [],
}

DEFAULT_ADMIN_PERMISSIONS = {
    item["key"]: list(item["actions"]) for item in CRM_MODULES
}

PROPOSAL_TEMPLATES = [
    {
        "key": "website-development",
        "name": "Website Development",
        "service": "Website Development",
        "title": "Corporate Website Development",
        "overview": (
            "A modern, responsive and search-friendly website for {business}, built to present the "
            "business clearly and convert visitors into enquiries."
        ),
        "scope": [
            "Requirement discovery and sitemap sign-off",
            "Custom UI design for all pages (desktop, tablet, mobile)",
            "Responsive front-end development with on-page SEO basics",
            "Contact forms, WhatsApp click-to-chat and Google Maps",
            "Performance, security and cross-browser testing",
            "Deployment and handover with a short training session",
        ],
        "deliverables": [
            "Fully responsive website",
            "Design source files",
            "Admin content guide",
            "30 days post-launch support",
        ],
        "tech_stack": [
            "HTML5 / Tailwind CSS / React",
            "Next.js / TypeScript",
            "SEO & OpenGraph Meta",
            "Cloudflare CDN & SSL",
        ],
        "timeline": [
            {"phase": "Discovery & Sitemap", "duration": "3 days"},
            {"phase": "UI Design", "duration": "5 days"},
            {"phase": "Development", "duration": "10 days"},
            {"phase": "Testing & Launch", "duration": "4 days"},
        ],
        "terms": [
            "The project timeline starts after receipt of the advance payment and approved content.",
            "Two rounds of design revisions are included; further changes are quoted separately.",
            "Domain and hosting charges are billed at actuals unless stated otherwise.",
            "Final handover is made after full and final payment.",
        ],
        "payment_terms": "50% advance to start, 30% after design approval, 20% before launch.",
        "additional_costs": "Domain and hosting, premium stock assets and third-party plugins are billed at actuals.",
    },
    {
        "key": "web-application",
        "name": "Web Application Development",
        "service": "Web Application Development",
        "title": "Web Application Development",
        "overview": (
            "A tailored web application for {business} that replaces manual workflows with a secure, "
            "role-based system built around your operating process."
        ),
        "scope": [
            "Process study and functional requirement documentation",
            "Role-based access control and user management",
            "Database design and API development",
            "Responsive application interface",
            "Reports, exports and activity history",
            "Deployment, QA and handover",
        ],
        "deliverables": [
            "Deployed web application",
            "Source code ownership",
            "API documentation",
            "60 days warranty support",
        ],
        "tech_stack": [
            "React.js / TypeScript",
            "FastAPI / Python",
            "PostgreSQL Database",
            "Docker / Nginx",
        ],
        "timeline": [
            {"phase": "Discovery & Documentation", "duration": "1 week"},
            {"phase": "UI/UX Design", "duration": "1 week"},
            {"phase": "Development & Internal QA", "duration": "4 weeks"},
            {"phase": "UAT & Launch", "duration": "1 week"},
        ],
        "terms": [
            "Scope is limited to the features documented in this proposal.",
            "Change requests are estimated and approved separately.",
            "Client provides content, credentials and a single point of contact.",
            "Source code is transferred after full payment.",
        ],
        "payment_terms": "40% advance, 40% at UAT, 20% after final handover.",
        "additional_costs": "Cloud hosting, SMS/email gateways and paid APIs are billed at actuals.",
    },
    {
        "key": "custom-software",
        "name": "Custom Software Development",
        "service": "Custom Software Development",
        "title": "Custom Software Solution",
        "overview": (
            "A purpose-built software solution for {business}, designed to automate core operations, "
            "centralise data and support informed decision making."
        ),
        "scope": [
            "Detailed system analysis and architecture",
            "Custom module development with role-based permissions",
            "Integrations with existing tools and data migration",
            "Automated reports and audit trail",
            "Staged rollout and team training",
        ],
        "deliverables": [
            "Production software build",
            "Technical architecture document",
            "User manual and training",
            "90 days support",
        ],
        "tech_stack": [
            "React.js / Next.js",
            "FastAPI / Python",
            "PostgreSQL",
            "Docker",
            "AWS / Cloud Hosting",
        ],
        "timeline": [
            {"phase": "Analysis & Architecture", "duration": "2 weeks"},
            {"phase": "Core Modules", "duration": "5 weeks"},
            {"phase": "Integrations & Reports", "duration": "2 weeks"},
            {"phase": "UAT & Rollout", "duration": "1 week"},
        ],
        "terms": [
            "Estimates assume timely feedback at each milestone.",
            "Third-party licensing costs are not included.",
            "Data migration is limited to the formats agreed during discovery.",
            "Annual maintenance is optional and quoted separately.",
        ],
        "payment_terms": "30% advance, 30% on core module demo, 30% at UAT, 10% after sign-off.",
        "additional_costs": "Server infrastructure, third-party licences and on-site travel are billed separately.",
    },
    {
        "key": "hospital-erp",
        "name": "Hospital Management ERP",
        "service": "Hospital Management ERP",
        "title": "Hospital Management ERP & Healthcare Information System",
        "overview": (
            "An enterprise healthcare management system for {business}, unifying Outpatient (OPD), "
            "Inpatient (IPD), Pharmacy, Laboratory, Billing, Patient Electronic Health Records (EHR) and "
            "NABH compliance into a modern, high-security digital platform."
        ),
        "scope": [
            "Patient Registration & Smart Queue Management (OPD)",
            "Inpatient Admission, Bed Allocation, Nursing & Discharge Management (IPD)",
            "Electronic Medical Records (EMR / EHR) with Prescription & Diagnosis History",
            "Pharmacy Inventory, Dispensation, Stock Alerts & Batch Expiry Tracking",
            "Laboratory Information Management (LIMS) with Digital Test Reports",
            "Integrated Medical Billing, Insurance (TPA) & Payment Gateways",
            "Doctor Rostering, Appointment Scheduling & Teleconsultation Portal",
            "NABH / HIPAA Security Standards, Role-Based Access & Audit Logging",
        ],
        "deliverables": [
            "Complete Hospital ERP Web Platform & Doctor/Staff Portal",
            "Patient Mobile-Friendly Portal for Appointments & Test Reports",
            "Full Source Code & Database Architecture",
            "Staff & Administration Training Sessions with Detailed User Manuals",
            "180 Days Dedicated Warranty & 24/7 SLA Technical Support",
        ],
        "tech_stack": [
            "React.js / Next.js Enterprise",
            "FastAPI / Python Microservices",
            "PostgreSQL Enterprise with Encryption",
            "Redis In-Memory Cache",
            "Docker / Kubernetes Infrastructure",
            "HIPAA & NABH Compliant Cloud Hosting",
        ],
        "timeline": [
            {"phase": "Requirement Discovery & Workflow Mapping", "duration": "2 weeks"},
            {"phase": "Architecture & Core Modules (OPD, IPD, EHR)", "duration": "6 weeks"},
            {"phase": "Pharmacy, Lab & Billing Integration", "duration": "4 weeks"},
            {"phase": "NABH Security Testing, UAT & Staff Training", "duration": "2 weeks"},
            {"phase": "Go-Live & Onsite Support", "duration": "2 weeks"},
        ],
        "terms": [
            "Patient data privacy and HIPAA/NABH compliance protocols are strictly adhered to.",
            "Legacy data migration is included for formats agreed during discovery.",
            "Hardware, biometric devices and third-party SMS/WhatsApp gateway charges are billed at actuals.",
            "Annual Maintenance Contract (AMC) is available following the 180-day warranty period.",
            "Source code and database IP are fully transferred upon final settlement.",
        ],
        "payment_terms": "30% advance on sign-off, 25% on core modules demo, 25% on Lab & Billing integration, 20% on Go-Live.",
        "additional_costs": "Cloud hosting servers, SSL certificates, SMS/WhatsApp notification credits and third-party lab machine API drivers billed at actuals.",
    },
    {
        "key": "seo-services",
        "name": "SEO Services",
        "service": "SEO Services",
        "title": "Search Engine Optimisation",
        "overview": (
            "A structured SEO programme for {business} focused on technical health, content quality and "
            "local search visibility."
        ),
        "scope": [
            "Technical SEO audit and fix roadmap",
            "Keyword research and mapping",
            "On-page optimisation for priority pages",
            "Local SEO and Google Business Profile alignment",
            "Monthly reporting with ranking and traffic movement",
        ],
        "deliverables": [
            "SEO audit report",
            "Keyword strategy sheet",
            "Monthly performance dashboard",
            "Monthly action summary",
        ],
        "timeline": [
            {"phase": "Audit & Strategy", "duration": "Week 1"},
            {"phase": "On-page Fixes", "duration": "Week 2-3"},
            {"phase": "Content & Local SEO", "duration": "Week 3-4"},
            {"phase": "Reporting Cycle", "duration": "Ongoing monthly"},
        ],
        "terms": [
            "Search rankings are influenced by third-party algorithms and cannot be guaranteed.",
            "Content writing beyond the agreed volume is billed separately.",
            "Client approves all content before publishing.",
            "Engagement is for the stated duration and renews on written agreement.",
        ],
        "payment_terms": "Monthly retainer, invoiced in advance.",
        "additional_costs": "Paid tools, content writing and link-building budgets are billed separately.",
    },
    {
        "key": "digital-marketing",
        "name": "Digital Marketing",
        "service": "Digital Marketing",
        "title": "Digital Marketing Programme",
        "overview": (
            "An integrated digital marketing engagement for {business} covering search, social and "
            "performance campaigns with clear reporting."
        ),
        "scope": [
            "Marketing audit and channel plan",
            "Campaign structure and creative direction",
            "Search and social ad management",
            "Landing page optimisation",
            "Conversion tracking and monthly reporting",
        ],
        "deliverables": [
            "Channel strategy document",
            "Campaign setup and creatives",
            "Conversion tracking setup",
            "Weekly/monthly performance reports",
        ],
        "timeline": [
            {"phase": "Audit & Plan", "duration": "Week 1"},
            {"phase": "Setup & Creatives", "duration": "Week 2"},
            {"phase": "Campaign Launch", "duration": "Week 3"},
            {"phase": "Optimisation", "duration": "Ongoing"},
        ],
        "terms": [
            "Advertising spend is separate from the management fee.",
            "Creative assets provided by the client must be licensed.",
            "Campaign performance depends on market and platform factors.",
            "Reports are shared on the agreed monthly cycle.",
        ],
        "payment_terms": "Monthly management fee in advance plus advertising spend.",
        "additional_costs": "Ad spend, premium creatives, influencer fees and tools are billed separately.",
    },
    {
        "key": "social-media",
        "name": "Social Media Management",
        "service": "Social Media Management",
        "title": "Social Media Management",
        "overview": (
            "Consistent, on-brand social media management for {business}, built around a monthly content "
            "calendar and community engagement."
        ),
        "scope": [
            "Monthly content calendar and captions",
            "Design of agreed post creatives",
            "Scheduling and publishing",
            "Community engagement and comment handling",
            "Monthly analytics summary",
        ],
        "deliverables": [
            "12 posts per month",
            "4 reels/short videos per month",
            "Monthly content calendar",
            "Monthly performance summary",
        ],
        "timeline": [
            {"phase": "Brand & Content Plan", "duration": "Week 1"},
            {"phase": "Content Production", "duration": "Week 2-3"},
            {"phase": "Publishing & Engagement", "duration": "Ongoing"},
            {"phase": "Monthly Review", "duration": "Month end"},
        ],
        "terms": [
            "Client approvals for the calendar are required before publishing.",
            "Shoot costs and paid promotions are not included.",
            "Two rounds of creative revisions per month are included.",
            "Account credentials remain the property of the client.",
        ],
        "payment_terms": "Monthly retainer, invoiced in advance.",
        "additional_costs": "Photography, video shoots, boosting budgets and influencer collaborations are extra.",
    },
    {
        "key": "google-business-profile",
        "name": "Google Business Profile Setup",
        "service": "Google Business Profile Setup",
        "title": "Google Business Profile Setup & Optimisation",
        "overview": (
            "A complete Google Business Profile setup and optimisation for {business} to improve local "
            "discovery, calls and direction requests."
        ),
        "scope": [
            "Profile creation or verification support",
            "Category, service and attribute optimisation",
            "Business description and Q&A setup",
            "Photo and post planning",
            "Review response guidelines",
        ],
        "deliverables": [
            "Verified and optimised profile",
            "Photo and post plan",
            "Local SEO checklist",
            "30 days support",
        ],
        "timeline": [
            {"phase": "Profile Audit", "duration": "2 days"},
            {"phase": "Setup & Optimisation", "duration": "3 days"},
            {"phase": "Content & Posts", "duration": "3 days"},
            {"phase": "Handover", "duration": "1 day"},
        ],
        "terms": [
            "Verification timelines are controlled by Google.",
            "Client must provide accurate business documentation.",
            "Review generation is the client's responsibility; response templates are provided.",
        ],
        "payment_terms": "100% advance.",
        "additional_costs": "Google Ads, photography and additional locations are billed separately.",
    },
    {
        "key": "custom-service",
        "name": "Custom Service",
        "service": "Custom Service",
        "title": "Custom Digital Service Proposal",
        "overview": (
            "A tailored digital solution and consulting engagement designed specifically to meet the "
            "unique operational, technical and marketing objectives of {business}."
        ),
        "scope": [
            "Tailored requirement discovery and technical consulting",
            "Custom solution architecture and service execution roadmap",
            "Milestone deliverables and quality assurance reviews",
            "Stakeholder presentations and technical documentation",
            "Post-delivery warranty and handover support",
        ],
        "deliverables": [
            "Custom project deliverables as defined in specification",
            "Complete source code ownership or creative assets",
            "Executive summary and project documentation",
            "60 days dedicated technical warranty support",
        ],
        "timeline": [
            {"phase": "Discovery & Alignment", "duration": "1 week"},
            {"phase": "Phase 1 Delivery", "duration": "2 weeks"},
            {"phase": "Phase 2 Delivery", "duration": "2 weeks"},
            {"phase": "Final Review & Handover", "duration": "1 week"},
        ],
        "terms": [
            "Scope is strictly limited to deliverables explicitly listed in this document.",
            "Any additional feature requests will be estimated as a separate change request.",
            "Client provides necessary assets, access credentials, and designated approvals promptly.",
            "Final deliverables and copyright transfer are completed upon receipt of full payment.",
        ],
        "payment_terms": "50% advance upon project sign-off, 30% upon milestone 1, 20% upon final delivery.",
        "additional_costs": "Third-party APIs, specialized cloud hosting and domain licenses billed at actuals.",
    },
]
