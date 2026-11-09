export interface StepInstruction {
  step: number;
  title: string;
  description: string;
  tip?: string;
}

export interface ModuleDocumentation {
  key: string;
  title: string;
  shortDescription: string;
  iconName: string;
  adminResponsibilities: string[];
  staffResponsibilities: string[];
  keyFeatures: string[];
  workflowSteps: StepInstruction[];
  bestPractices: string[];
  permittedActions: { action: string; description: string }[];
  statusLifecycle?: { status: string; label: string; description: string }[];
}

export interface FAQItem {
  question: string;
  answer: string;
  category: "account" | "attendance" | "leads" | "calls" | "proposals" | "permissions";
  roles: ("admin" | "staff")[];
}

export interface TroubleshootingItem {
  id: string;
  issue: string;
  symptom: string;
  cause: string;
  resolution: string[];
  role: "admin" | "staff" | "both";
}

export const MODULE_DOCS: Record<string, ModuleDocumentation> = {
  dashboard: {
    key: "dashboard",
    title: "Executive & Staff Dashboard",
    shortDescription:
      "Real-time operational command centre calculating live metrics, activity feeds, follow-up deadlines and attendance pulse.",
    iconName: "LayoutDashboard",
    adminResponsibilities: [
      "Monitor company-wide lead pipeline velocity and conversion ratios.",
      "Review daily call volumes, outcomes, and staff activity streams.",
      "Track pending proposals and follow-up deadlines across all team members.",
      "Inspect today's attendance live board to check who is working, on break, or absent.",
      "Filter business metrics by presets (Today, 7 Days, 30 Days, 90 Days) to inform operational decisions.",
    ],
    staffResponsibilities: [
      "Review 'My Assigned Leads' and prioritize enquiries requiring action.",
      "Track daily call count against personal activity targets.",
      "Check 'Pending Follow-ups' due today to avoid missing client commitments.",
      "Review upcoming scheduled meetings (Google Meet, on-site, phone).",
      "Monitor today's attendance timer and record check-in/out transitions.",
    ],
    keyFeatures: [
      "Zero hardcoded metrics: all cards calculate dynamically from database records.",
      "Role-aware cards: Admins see organization totals; Staff see their assigned portfolio.",
      "Interactive pipeline charts showing lead status distributions and call outcomes.",
      "Quick Action buttons for instant Lead creation, Call logging, and Proposal drafting.",
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Log in & Review Workspace Summary",
        description:
          "Open the dashboard immediately after check-in. The cards summarize all high-priority items requiring attention today.",
      },
      {
        step: 2,
        title: "Inspect Follow-ups & Meetings",
        description:
          "Review the 'Follow-ups Pending' and 'Meetings Scheduled' sections. Click any record to inspect client background before reaching out.",
      },
      {
        step: 3,
        title: "Check Live Attendance Timer",
        description:
          "Verify your active attendance status at the top right of the dashboard. Ensure your timer is running while working.",
      },
    ],
    bestPractices: [
      "Review the dashboard first thing in the morning and right before end-of-day check-out.",
      "Never leave overdue follow-ups sitting in your queue; reschedule or close them promptly.",
      "Admins should use date range presets to compare weekly performance trends.",
    ],
    permittedActions: [
      { action: "view", description: "View the dashboard cards, charts, and activity feeds." },
    ],
  },

  leads: {
    key: "leads",
    title: "Lead Management",
    shortDescription:
      "Central database of all business prospects, enquiries, service requirements, assignment history and conversion milestones.",
    iconName: "Users",
    adminResponsibilities: [
      "Review incoming leads from website, referrals, social media and campaigns.",
      "Assign leads to appropriate staff members based on capacity and expertise.",
      "Monitor lead progression through the pipeline stages (New → Interested → Converted).",
      "Export lead datasets to CSV for external audits or marketing analysis.",
      "Permanently delete invalid or spam enquiries (Admin-only privilege).",
    ],
    staffResponsibilities: [
      "Review leads assigned to your portfolio.",
      "Research prospective businesses thoroughly before initiating contact.",
      "Record every phone conversation and interaction against the lead record.",
      "Update contact information, business location and specific service requirements.",
      "Update lead status based on honest client feedback (never guess or invent interest).",
    ],
    keyFeatures: [
      "Unified Lead Timeline: Calls, follow-ups, proposals and meetings attach to the parent lead.",
      "Duplicate Prevention: Every phone call connects to an existing lead code (e.g. LD-0042).",
      "Multi-Service Tagging: Tag leads with Website Development, Custom Software, Digital Marketing, etc.",
      "Direct Conversion: 1-click conversion to a formal Client record once approved.",
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Add or Open a Lead",
        description:
          "Click '+ Add Lead' from the Leads page or Command Palette (Ctrl+K). Enter Business Name, Contact Person, Phone, Email, Location and Services.",
      },
      {
        step: 2,
        title: "Review Lead Requirements",
        description:
          "Click the eye icon to view the lead modal. Review previous communication notes, logged calls and service interests.",
      },
      {
        step: 3,
        title: "Initiate Professional Outreach",
        description:
          "Call the prospective client. Introduce STACKZYRO solutions politely and understand their technical requirement.",
      },
      {
        step: 4,
        title: "Record Interaction & Set Follow-up",
        description:
          "Click 'Record Call' on the lead. Choose an honest outcome (e.g. Interested, Call Back Requested) and schedule the next follow-up.",
      },
      {
        step: 5,
        title: "Update Status or Convert",
        description:
          "If the lead agrees to proceed, update status to 'Accepted' or 'Proposal Required'. Admins can convert the lead to a Client record.",
      },
    ],
    bestPractices: [
      "Never invent requirements or mark a lead 'Interested' without verified client enthusiasm.",
      "Always capture the decision maker's direct phone number and designation.",
      "If a client explicitly declines, mark the outcome 'Do Not Contact' to maintain professional ethics.",
    ],
    permittedActions: [
      { action: "view", description: "Browse leads list and read lead profiles." },
      { action: "create", description: "Add new prospective business enquiries into the CRM." },
      { action: "edit", description: "Update lead details, service tags, and requirements." },
      { action: "delete", description: "Permanently delete lead records (Admin only)." },
      { action: "export", description: "Download filtered lead records as a CSV file." },
      { action: "assign", description: "Assign or reassign leads to staff members." },
    ],
    statusLifecycle: [
      { status: "new", label: "New", description: "Fresh enquiry that has not yet been contacted." },
      { status: "interested", label: "Interested", description: "Lead verified interest and requested details or follow-up." },
      { status: "proposal_required", label: "Proposal Required", description: "Lead requested a formal technical proposal and quotation." },
      { status: "accepted", label: "Accepted", description: "Lead accepted proposal terms and agreed to onboard." },
      { status: "converted", label: "Converted", description: "Lead has been officially converted into an active Client." },
      { status: "not_interested", label: "Not Interested", description: "Lead politely declined or has no current requirement." },
    ],
  },

  calls: {
    key: "calls",
    title: "Call Management",
    shortDescription:
      "Granular log of every outbound and inbound phone consultation, outcome tagging and automated follow-up scheduling.",
    iconName: "PhoneCall",
    adminResponsibilities: [
      "Monitor team call metrics: total calls made today, outcome ratios, and staff call volumes.",
      "Review conversation notes to ensure quality communication standards.",
      "Identify leads marked 'Do Not Contact' to ensure team compliance.",
      "Export call logs for performance reviews and client history auditing.",
    ],
    staffResponsibilities: [
      "Log every customer call immediately after hanging up—never batch-record at the end of the day.",
      "Select the accurate outcome corresponding to the real discussion.",
      "Write concise, helpful notes detailing customer objections, requirements or budget expectations.",
      "Check 'Schedule Follow-up' to automatically queue the next call in the CRM.",
    ],
    keyFeatures: [
      "Zero Overwriting: Multiple calls to the same lead create separate sequential records.",
      "7 Distinct Outcomes: Interested, Not Interested, Not Taken, Call Back Requested, Accepted, Proposal Required, Do Not Contact.",
      "Integrated Follow-up: Optionally create a due follow-up task directly from the call modal.",
      "Fast Lead Search: Type lead code or business name to link calls in seconds.",
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Click 'Record Call'",
        description:
          "Open Call Management and click '+ Record Call', or click the phone icon directly from any lead row.",
      },
      {
        step: 2,
        title: "Select Lead & Timestamp",
        description:
          "Search and pick the lead. The timestamp defaults to current time but can be adjusted if recording shortly after.",
      },
      {
        step: 3,
        title: "Select Accurate Outcome",
        description:
          "Choose the appropriate outcome (e.g. Call Back Requested if the client was busy; Not Taken if no answer).",
      },
      {
        step: 4,
        title: "Add Professional Notes",
        description:
          "Summarize what was discussed: 'Spoke with Mr. Ramesh. Needs ecommerce catalog with payment gateway. Follow up Thursday 3 PM.'",
      },
      {
        step: 5,
        title: "Queue Next Follow-up & Save",
        description:
          "Enable 'Schedule follow-up', pick the agreed date and time, and click 'Save Call Record'.",
      },
    ],
    bestPractices: [
      "Log 'Not Taken' calls so colleagues know an attempt was made without duplicating outreach.",
      "Always record specific dates and times promised by the client for follow-ups.",
      "Never fabricate call logs—all records carry actor timestamps and audit fingerprints.",
    ],
    permittedActions: [
      { action: "view", description: "View call logs and communication history." },
      { action: "create", description: "Record a new call entry." },
      { action: "edit", description: "Update notes on an existing call record." },
      { action: "delete", description: "Remove erroneous call records (Admin only)." },
      { action: "export", description: "Export call logs to CSV." },
    ],
  },

  followups: {
    key: "followups",
    title: "Follow-ups & Reminders",
    shortDescription:
      "Task management engine tracking scheduled client touchpoints, deadlines, overdue warnings and completion logs.",
    iconName: "CalendarClock",
    adminResponsibilities: [
      "Track overdue follow-ups across the entire team to prevent lost opportunities.",
      "Reassign follow-ups if an employee is on leave or facing high workload.",
      "Audit follow-up completion rates in staff performance reports.",
    ],
    staffResponsibilities: [
      "Check pending follow-ups every morning before starting calls.",
      "Execute scheduled follow-ups on the agreed date and time.",
      "Mark follow-ups completed only after the client interaction has taken place.",
      "Respect client wishes: never follow up if client asked to be removed from communication.",
    ],
    keyFeatures: [
      "Multi-Channel Methods: Call, WhatsApp, Email, Meeting, or In-person Visit.",
      "Overdue Detection: Automatically flags tasks past their due time in high-contrast amber/red badges.",
      "Quick Completion Modal: Mark complete with a 1-click note and schedule the next step seamlessly.",
      "Direct Lead Linkage: Jump directly to the lead profile with full background context.",
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Review Due Follow-ups",
        description:
          "Open the Follow-ups page. Filter by 'Pending' or 'Overdue' to see what requires attention.",
      },
      {
        step: 2,
        title: "Connect via Scheduled Method",
        description:
          "Reach out using the specified method (e.g. Phone call or WhatsApp message). Reference previous discussion notes.",
      },
      {
        step: 3,
        title: "Complete the Follow-up",
        description:
          "Click the checkmark action icon. Enter outcome notes explaining how the interaction went.",
      },
      {
        step: 4,
        title: "Schedule Subsequent Action",
        description:
          "If the client requires further consultation, schedule the next follow-up date and time immediately.",
      },
    ],
    bestPractices: [
      "Never let a follow-up sit overdue for more than 24 hours.",
      "Always review past call notes before calling to provide a personalized customer experience.",
      "Honor client meeting windows strictly—punctuality builds corporate trust.",
    ],
    permittedActions: [
      { action: "view", description: "Browse scheduled and completed follow-up items." },
      { action: "create", description: "Schedule a new follow-up reminder." },
      { action: "edit", description: "Update due date, method, or notes." },
      { action: "delete", description: "Cancel or delete a follow-up record." },
    ],
  },

  proposals: {
    key: "proposals",
    title: "Proposals & Quotations",
    shortDescription:
      "Commercial quotation builder with structured service scopes, pricing tables, milestone timelines and approval governance.",
    iconName: "FileText",
    adminResponsibilities: [
      "Review draft proposals submitted by staff members.",
      "Inspect pricing line items, scope boundaries, tax calculations and profit margins.",
      "Approve or reject proposals (`pending_approval` → `approved`).",
      "Authorize delivery of commercial contracts and discounts to prospective clients.",
      "Monitor overall proposal acceptance ratios.",
    ],
    staffResponsibilities: [
      "Select approved STACKZYRO proposal templates (e.g. Corporate Website, Custom Software).",
      "Draft accurate scopes based on verified client discovery sessions.",
      "Submit draft proposals for Admin approval (Staff cannot send unapproved quotations).",
      "Track proposal status and answer client technical queries.",
      "Never promise unauthorized discounts or deviate from approved pricing guidelines.",
    ],
    keyFeatures: [
      "Official STACKZYRO Templates: Pre-configured scopes for Website, Web App, and Custom Software.",
      "Interactive Pricing Matrix: Quantity, rate, subtotal, discount and tax calculations.",
      "Milestone Timelines: Clearly structured phases (Discovery, Design, Development, Launch).",
      "Print & PDF Export: Professional high-resolution proposal presentation ready for clients.",
      "Approval Safeguard: Quotations require Admin approval before being marked 'Sent'.",
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Create Proposal",
        description:
          "Open Proposals and click '+ New Proposal'. Select the prospective Lead and choose an official template.",
      },
      {
        step: 2,
        title: "Customize Scope & Pricing",
        description:
          "Review the generated scope, deliverables, timeline phases and add line items with quantities and rates.",
      },
      {
        step: 3,
        title: "Submit for Admin Approval",
        description:
          "Staff save the proposal in 'Pending Approval' status. An Admin reviews commercial terms before authorization.",
      },
      {
        step: 4,
        title: "Admin Review & Approval",
        description:
          "Admin inspects the proposal preview. If terms are sound, Admin clicks 'Approve Proposal'.",
      },
      {
        step: 5,
        title: "Send to Client & Record Decision",
        description:
          "Send the approved proposal PDF to the client. When the client accepts, mark 'Accepted' to trigger client onboarding.",
      },
    ],
    bestPractices: [
      "Always double-check client company legal name and GST/tax details before submission.",
      "Ensure payment terms (e.g. 50% advance, 30% design approval, 20% launch) are clearly agreed.",
      "Never share draft or unapproved proposals with prospective clients.",
    ],
    permittedActions: [
      { action: "view", description: "View proposals and document previews." },
      { action: "create", description: "Draft a new proposal from templates." },
      { action: "edit", description: "Edit scope, pricing, terms and timeline items." },
      { action: "delete", description: "Delete obsolete draft proposals (Admin only)." },
      { action: "export", description: "Export proposal to PDF or print preview." },
      { action: "approve", description: "Officially approve proposals for client transmission (Admin privilege)." },
    ],
    statusLifecycle: [
      { status: "draft", label: "Draft", description: "Initial proposal being prepared by staff." },
      { status: "pending_approval", label: "Pending Approval", description: "Submitted to Admin for commercial and scope review." },
      { status: "approved", label: "Approved", description: "Authorized by Admin; ready to be sent to the client." },
      { status: "sent", label: "Sent", description: "Delivered to prospective client for evaluation." },
      { status: "accepted", label: "Accepted", description: "Client accepted terms and pricing; ready for client conversion." },
      { status: "rejected", label: "Rejected", description: "Client declined quotation or opted for a different solution." },
      { status: "expired", label: "Expired", description: "Validity window elapsed without client decision." },
    ],
  },

  meetings: {
    key: "meetings",
    title: "Meeting Management",
    shortDescription:
      "Calendar and agenda coordination for Google Meet sessions, client discovery calls and on-site business conferences.",
    iconName: "CalendarDays",
    adminResponsibilities: [
      "Oversee scheduled client meetings across departments.",
      "Assign senior consultants or technical leads to high-value discovery sessions.",
      "Review post-meeting notes and verify proper requirements handover.",
    ],
    staffResponsibilities: [
      "Schedule meetings at times convenient for the client.",
      "Generate and attach valid Google Meet links or specify exact meeting venues.",
      "Prepare all discovery questions and lead history before joining.",
      "Record detailed meeting minutes and update meeting status to 'Completed'.",
      "Hand over functional requirements to project delivery teams.",
    ],
    keyFeatures: [
      "Meeting Types: Google Meet, On-site office visit, or Phone conference.",
      "Direct Join Link: 1-click button to open Google Meet conferences directly from CRM.",
      "Duration & Notes: Track scheduled duration and document comprehensive meeting minutes.",
      "Status Tracking: Scheduled, Completed, Rescheduled, Cancelled.",
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Schedule Meeting",
        description:
          "Click '+ Schedule Meeting' on the Meetings page. Select Lead, Meeting Type, Date, Time, and Duration.",
      },
      {
        step: 2,
        title: "Provide Location or Video Link",
        description:
          "If Google Meet, paste the meeting URL. If on-site, specify office address or client premises.",
      },
      {
        step: 3,
        title: "Conduct the Meeting",
        description:
          "Meet punctually. Take notes on architecture requirements, budget expectations and project timelines.",
      },
      {
        step: 4,
        title: "Update Outcome & Handover",
        description:
          "Mark meeting 'Completed', paste meeting minutes, and trigger proposal drafting or technical handover.",
      },
    ],
    bestPractices: [
      "Test your microphone, camera and Google Meet link 5 minutes prior to start time.",
      "Send a calendar reminder or WhatsApp message to the client 1 hour before the meeting.",
      "Document key decisions in CRM immediately while conversations are fresh.",
    ],
    permittedActions: [
      { action: "view", description: "Browse scheduled and completed meetings." },
      { action: "create", description: "Schedule a new meeting." },
      { action: "edit", description: "Update meeting time, link or minutes." },
      { action: "delete", description: "Cancel or remove meeting entries." },
    ],
  },

  clients: {
    key: "clients",
    title: "Client Accounts",
    shortDescription:
      "Directory of onboarded clients, contracted digital services, project execution status and dedicated staff ownership.",
    iconName: "Building2",
    adminResponsibilities: [
      "Convert accepted leads or proposals into permanent client records.",
      "Assign dedicated account managers and project delivery staff.",
      "Monitor project lifecycle statuses (In Progress, On Hold, Completed, Cancelled).",
      "Review client contact details, contract commencement dates and service portfolios.",
    ],
    staffResponsibilities: [
      "View permitted client records to coordinate service deliverables.",
      "Maintain active communication notes regarding project milestones.",
      "Notify Admin immediately if a client requests scope changes or service expansions.",
    ],
    keyFeatures: [
      "Permanent Account History: Retains all original lead records, past calls and proposals.",
      "Project Status Management: In Progress, On Hold, Completed, Cancelled.",
      "Assigned Account Ownership: Clear staff attribution for client satisfaction.",
      "Direct Contact Quick Actions: 1-click phone dial and email outreach.",
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Convert from Lead or Proposal",
        description:
          "From any accepted lead or proposal, click 'Convert to Client'. Client code (e.g. CLI-009) is assigned automatically.",
      },
      {
        step: 2,
        title: "Assign Project Manager",
        description:
          "Assign the responsible staff member who will oversee technical execution and client updates.",
      },
      {
        step: 3,
        title: "Track Project Milestones",
        description:
          "Update project status as deliverables progress from In Progress to Completed.",
      },
    ],
    bestPractices: [
      "Keep client contact details up to date at all times.",
      "Always document contract start dates and scope boundaries clearly.",
    ],
    permittedActions: [
      { action: "view", description: "View client profiles and active service accounts." },
      { action: "create", description: "Manually create client accounts." },
      { action: "edit", description: "Update client status, services and notes." },
      { action: "delete", description: "Archive or delete client accounts (Admin only)." },
      { action: "export", description: "Export client directory to CSV." },
    ],
  },

  attendance: {
    key: "attendance",
    title: "Multiple Check-In & Check-Out Attendance",
    shortDescription:
      "High-accuracy continuous workplace attendance recording every departure, break reason, return and exact working duration.",
    iconName: "ClipboardCheck",
    adminResponsibilities: [
      "Inspect the 'Live Board' in real time to monitor who is currently working, on break, or absent.",
      "Review every employee's complete session audit trail for any given date.",
      "Verify reasons provided for leaving the office (Lunch, Client Meeting, Business Visit, etc.).",
      "Perform attendance corrections with a mandatory written justification when staff miss an event.",
      "Export comprehensive Daily and Monthly attendance reports in CSV format for payroll.",
    ],
    staffResponsibilities: [
      "Press 'Check In' immediately upon arriving at the office or beginning official remote work.",
      "Press 'Check Out' EVERY time you leave your desk for lunch, tea, client visits or personal reasons.",
      "Select the truthful departure reason and add an optional note.",
      "Press 'Check In' again the moment you return to resume work.",
      "Perform the final 'Check Out' with reason 'End of Day' when concluding work for the day.",
      "Never ask or permit another employee to check in on your behalf (strictly prohibited).",
      "Inform Admin immediately if you forgot to check in or out so a documented correction can be made.",
    ],
    keyFeatures: [
      "Multiple Check-In/Check-Out: No limit to 1 check-in per day; accurately tracks all exits and returns.",
      "Session-Based Math: Total Working Time is sum of active sessions; Total Break Time is sum of gaps.",
      "Reason Categorization: 8 pre-configured reasons including Lunch, Tea, Client Meeting, Business Visit, End of Day.",
      "Admin Correction Audit: Corrections require mandatory reasons and log the Admin actor ID.",
      "Live Real-Time Status Board: Color-coded indicators showing instant workplace presence.",
      "Automated CSV Reports: Export daily session breakdowns and monthly staff attendance matrices.",
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Morning Arrival (Check In)",
        description:
          "Upon arriving at work (e.g. 9:00 AM), open the CRM and click 'Check In'. Add an optional check-in note. Your active working timer starts immediately.",
      },
      {
        step: 2,
        title: "Leaving for an Appointment or Break (Check Out)",
        description:
          "When leaving the office (e.g. 11:15 AM for a Client Visit or 1:30 PM for Lunch), click 'Check Out'. Select the reason and save. Working timer pauses; break timer begins.",
      },
      {
        step: 3,
        title: "Returning to Work (Check In)",
        description:
          "Upon returning (e.g. 12:30 PM or 2:00 PM), click 'Check In' again. A new working session is created automatically.",
      },
      {
        step: 4,
        title: "End of Working Day (Final Check Out)",
        description:
          "At the end of your shift (e.g. 6:00 PM), click 'Check Out' and select reason 'End of Day'. Today's attendance is completed and stored.",
      },
      {
        step: 5,
        title: "Admin Correction Workflow",
        description:
          "If a staff member forgot to check out at 1:30 PM, Admin opens Attendance → History/Admin Tools, clicks 'Correct Session', enters the correct timestamp, inputs a mandatory reason, and saves.",
      },
    ],
    bestPractices: [
      "Distinguish temporary exits (Lunch, Client Visit) from the final departure (End of Day).",
      "Ensure client meetings and business visits outside the office are logged with proper reasons.",
      "Admins must always enter clear, honest justifications when manually editing attendance.",
    ],
    permittedActions: [
      { action: "view", description: "View attendance records, session logs and live status." },
      { action: "create", description: "Record personal check-in and check-out events." },
      { action: "edit", description: "Perform manual attendance session corrections (Admin privilege)." },
      { action: "export", description: "Download daily and monthly attendance CSV reports." },
    ],
  },

  staff: {
    key: "staff",
    title: "Staff & User Management",
    shortDescription:
      "Enterprise personnel administration, credential provisioning, role assignments, custom permission matrices and security controls.",
    iconName: "UserCog",
    adminResponsibilities: [
      "Create and provision unique staff accounts for all company employees.",
      "Assign roles (`admin` or `staff`) and enforce principle of least privilege.",
      "Configure granular module permissions per employee.",
      "Reset passwords securely using temporary credentials with forced reset on next login.",
      "Activate, deactivate, or suspend staff accounts without losing historical CRM records.",
      "Review staff activity metrics, conversion rates, and attendance logs.",
    ],
    staffResponsibilities: [
      "Keep personal login credentials confidential at all times.",
      "Change temporary password immediately upon first login to a secure private password.",
      "Never share CRM access tokens or leave authenticated sessions unattended on shared workstations.",
    ],
    keyFeatures: [
      "10-Step Secure Provisioning: Systematic account setup workflow.",
      "Granular Permission Matrix: Custom view, create, edit, delete, export, approve, assign rights per module.",
      "One-Way Bcrypt Encryption: Passwords can never be viewed or decrypted by anyone, including Admins.",
      "Forced Password Reset: New employees must change temporary password before accessing CRM.",
      "Non-Destructive Deactivation: Inactive staff accounts retain all linked call histories and lead logs.",
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Open Staff Management",
        description:
          "Navigate to Staff Management (/staff) from the sidebar or click 'Staff & User Management' under Settings.",
      },
      {
        step: 2,
        title: "Click 'Add Staff'",
        description:
          "Click the '+ Add Staff' button at the top right of the page to open the provisioning modal.",
      },
      {
        step: 3,
        title: "Enter Personal & Job Information",
        description:
          "Fill in Full Name, Email, Phone Number, Staff Code (e.g. STF-012), Designation (e.g. Business Development Assistant), and Department.",
      },
      {
        step: 4,
        title: "Create Unique Username",
        description:
          "Choose a distinct username (e.g. ayesha.sales). Usernames cannot be duplicated across the system.",
      },
      {
        step: 5,
        title: "Set Temporary Password",
        description:
          "Input a temporary password (min 8 characters) and confirm it. The system automatically marks `must_change_password = true`.",
      },
      {
        step: 6,
        title: "Assign Role & Status",
        description:
          "Select Role ('Staff' for general employees, 'Admin' for executive leadership) and set Status to 'Active'.",
      },
      {
        step: 7,
        title: "Configure Module Permissions",
        description:
          "Check the specific permissions required for their job role (e.g. Leads view/create/edit, Calls view/create). Do not grant delete or export unless necessary.",
      },
      {
        step: 8,
        title: "Save Account",
        description:
          "Click 'Create Staff Member'. The account is encrypted and committed to the database with a full audit log entry.",
      },
      {
        step: 9,
        title: "Deliver Credentials Securely",
        description:
          "Provide username and temporary password to employee in person or via secure private channel.",
      },
      {
        step: 10,
        title: "First Login & Forced Password Change",
        description:
          "Employee logs in at /login. The CRM intercepts the session and requires setting a new private password before proceeding.",
      },
    ],
    bestPractices: [
      "Never write passwords on sticky notes or send them via unencrypted public channels.",
      "Never grant 'Admin' role or 'delete' permissions to operational staff.",
      "When an employee departs the company, immediately deactivate their account to revoke access.",
    ],
    permittedActions: [
      { action: "view", description: "View staff list, profiles and activity statistics." },
      { action: "create", description: "Provision new staff member accounts." },
      { action: "edit", description: "Update employee details, designations and permission matrix." },
      { action: "delete", description: "Deactivate or remove staff accounts (Admin privilege)." },
      { action: "export", description: "Export staff roster and performance metrics to CSV." },
    ],
  },

  reports: {
    key: "reports",
    title: "Reports & Performance Analytics",
    shortDescription:
      "Comprehensive business intelligence suite generating conversion ratios, team performance rankings, call audits and attendance logs.",
    iconName: "BarChart3",
    adminResponsibilities: [
      "Analyze lead generation trends, source effectiveness and conversion funnels.",
      "Evaluate team productivity rankings: calls made, interested outcomes, follow-up completion rates.",
      "Identify communication bottlenecks and underperforming lead sources.",
      "Export report datasets to CSV for executive meetings and quarterly reviews.",
    ],
    staffResponsibilities: [
      "Review personal performance statistics (if permission is granted by Admin).",
      "Monitor personal follow-up completion percentages to maintain high service standards.",
    ],
    keyFeatures: [
      "8 Comprehensive Report Modules: Leads, Calls, Follow-ups, Proposals, Meetings, Staff Performance, Daily Attendance, Monthly Attendance.",
      "Flexible Date Presets: Today, Yesterday, This Week, This Month, and Custom Date Ranges.",
      "Staff Performance Leaderboard: Ranked by call volume, conversion rate, and attendance punctuality.",
      "Direct CSV Export: 1-click download of all computed analytical tables.",
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Open Reports Page",
        description:
          "Navigate to Reports (/reports). Select a date preset (e.g. This Month) or pick a custom date range.",
      },
      {
        step: 2,
        title: "Review KPI Summary Cards",
        description:
          "Inspect Total Leads, Total Calls Logged, Proposal Sent Volume, and Staff Attendance Averages.",
      },
      {
        step: 3,
        title: "Analyze Staff Performance Table",
        description:
          "Review individual team member metrics: calls made, interested leads, completed follow-ups, and presence days.",
      },
      {
        step: 4,
        title: "Export Report Data",
        description:
          "Click 'Export CSV' to download the analytical data for executive reporting or payroll verification.",
      },
    ],
    bestPractices: [
      "Review weekly reports every Monday morning to plan sales strategies for the week.",
      "Acknowledge high-performing staff members with top follow-up completion rates.",
    ],
    permittedActions: [
      { action: "view", description: "View analytics, charts, and team ranking tables." },
      { action: "export", description: "Download report datasets in CSV format." },
    ],
  },

  settings: {
    key: "settings",
    title: "Settings & System Configuration",
    shortDescription:
      "Account security, company profile, database status, audit log inspection and administrative controls.",
    iconName: "Settings",
    adminResponsibilities: [
      "Manage company brand information, contact details and regional settings.",
      "Inspect system database engine status (SQLite development fallback or PostgreSQL production).",
      "Review security configurations, password policies and CORS origin whitelisting.",
      "Audit all historical administrative activities and permission modifications.",
    ],
    staffResponsibilities: [
      "Update personal profile information (name, phone number).",
      "Change personal account password regularly to maintain high security.",
      "Review personal login history and active session metadata.",
    ],
    keyFeatures: [
      "Modular Tabs: Profile, Company Information, Security & Password, Audit Logs, Database Engine.",
      "Live Database Diagnostic: Shows active database connection, dialect and migration status.",
      "Password Change Validator: Enforces strong passwords with instant confirmation matching.",
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Navigate to Settings",
        description:
          "Open Settings (/settings) from the sidebar or click your profile avatar and select 'Account Settings'.",
      },
      {
        step: 2,
        title: "Update Personal Profile",
        description:
          "Under the 'Profile' tab, verify your phone number and contact details are accurate.",
      },
      {
        step: 3,
        title: "Update Password Securely",
        description:
          "Under the 'Security' tab, enter your current password, type a new strong password, confirm it and save.",
      },
    ],
    bestPractices: [
      "Never share your personal password with anyone.",
      "Choose passwords with at least 8 characters, combining uppercase, lowercase, numbers and symbols.",
    ],
    permittedActions: [
      { action: "view", description: "View system and personal account settings." },
      { action: "edit", description: "Update profile and company configuration." },
    ],
  },

  audit_logs: {
    key: "audit_logs",
    title: "Audit Logs & Security Trail",
    shortDescription:
      "Immutable chronological record of every system event, credential change, permission adjustment and attendance correction.",
    iconName: "ShieldCheck",
    adminResponsibilities: [
      "Inspect audit records to investigate suspicious activities or unauthorized changes.",
      "Verify that all manual attendance corrections include clear, justified business reasons.",
      "Review account permission changes to ensure compliance with company security standards.",
      "Track login attempts, IP addresses, and session timestamps.",
    ],
    staffResponsibilities: [
      "Understand that all CRM actions (calls, leads, attendance, edits) are tracked for quality assurance.",
    ],
    keyFeatures: [
      "Tamper-Proof Event Logging: Records Actor, Action, Entity, IP Address, and Pre/Post State JSON.",
      "Category Filtering: Auth, Staff, Attendance, Leads, Proposals, Settings.",
      "Attendance Correction Accountability: Every manual session adjustment stores the Admin ID and reason.",
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Access Audit Trail",
        description:
          "Admins can open Settings → Audit Logs tab or view recent activities on the main Dashboard.",
      },
      {
        step: 2,
        title: "Filter by Entity or Category",
        description:
          "Select categories such as 'attendance' or 'staff' to inspect specific operational events.",
      },
      {
        step: 3,
        title: "Inspect State Differences",
        description:
          "Review previous state and new state diffs to see exact field changes made during the event.",
      },
    ],
    bestPractices: [
      "Conduct monthly audit reviews to verify system integrity and user accountability.",
    ],
    permittedActions: [
      { action: "view", description: "Inspect system audit trails (Admin only)." },
      { action: "export", description: "Export audit logs to CSV (Admin only)." },
    ],
  },
};

export const ROLE_PERMISSION_EXAMPLES = [
  {
    roleTitle: "Office Assistant",
    department: "Administration & Operations",
    objective: "Manage front-office operations, daily attendance, client greetings and general inquiries.",
    recommendedPermissions: {
      dashboard: ["view"],
      attendance: ["view", "create"],
      clients: ["view"],
      leads: ["view"],
      calls: ["view"],
      followups: ["view"],
      proposals: [],
      meetings: ["view"],
      staff: [],
      reports: [],
      settings: [],
      audit_logs: [],
    },
    rationale:
      "Needs to record daily attendance, view client company names for visitor handling, but does not need access to commercial quotations, delete functions, or staff account controls.",
  },
  {
    roleTitle: "Business Development Assistant",
    department: "Sales & Client Acquisition",
    objective: "Cold outreach, lead nurturing, call logging, scheduling follow-ups and drafting quotes.",
    recommendedPermissions: {
      dashboard: ["view"],
      leads: ["view", "create", "edit"],
      calls: ["view", "create"],
      followups: ["view", "create", "edit"],
      meetings: ["view", "create"],
      proposals: ["view", "create"],
      clients: ["view"],
      attendance: ["view", "create"],
      staff: [],
      reports: [],
      settings: [],
      audit_logs: [],
    },
    rationale:
      "Requires full lead acquisition tools to log calls and schedule follow-ups. Can create draft proposals, but CANNOT approve proposals, delete leads, or export databases without Admin sign-off.",
  },
  {
    roleTitle: "Web Development Assistant",
    department: "Technical Engineering",
    objective: "Execute technical deliverables, build website modules, and attend technical client discovery.",
    recommendedPermissions: {
      dashboard: ["view"],
      clients: ["view"],
      meetings: ["view"],
      proposals: ["view"],
      attendance: ["view", "create"],
      leads: [],
      calls: [],
      followups: [],
      staff: [],
      reports: [],
      settings: [],
      audit_logs: [],
    },
    rationale:
      "Needs access to client project specifications and meeting notes. Does not require access to outbound cold-calling lists, lead assignments, or user administration.",
  },
  {
    roleTitle: "Digital Marketing Assistant",
    department: "Marketing & Growth",
    objective: "Import marketing campaign enquiries, evaluate lead sources and track campaign ROI.",
    recommendedPermissions: {
      dashboard: ["view"],
      leads: ["view", "create"],
      reports: ["view"],
      attendance: ["view", "create"],
      calls: ["view"],
      clients: ["view"],
      followups: [],
      proposals: [],
      meetings: [],
      staff: [],
      settings: [],
      audit_logs: [],
    },
    rationale:
      "Empowered to import leads generated from Meta, Google, or LinkedIn campaigns and review high-level lead source reports, but restricted from proposal approvals or staff user management.",
  },
];

export const ATTENDANCE_SCHEDULE_EXAMPLE = [
  { time: "9:00 AM", action: "Check In", reason: "Starting work", state: "Working", category: "work" },
  { time: "11:15 AM", action: "Check Out", reason: "Client visit", state: "Outside / Official Visit", category: "break" },
  { time: "12:30 PM", action: "Check In", reason: "Returned", state: "Working", category: "work" },
  { time: "1:30 PM", action: "Check Out", reason: "Lunch", state: "Lunch Break", category: "break" },
  { time: "2:00 PM", action: "Check In", reason: "Returned", state: "Working", category: "work" },
  { time: "4:00 PM", action: "Check Out", reason: "Business visit", state: "Outside / Business Visit", category: "break" },
  { time: "5:15 PM", action: "Check In", reason: "Returned", state: "Working", category: "work" },
  { time: "6:00 PM", action: "Check Out", reason: "End of day", state: "Completed / Shift Ended", category: "break" },
];

export const DAILY_ROUTINE_STEPS: StepInstruction[] = [
  {
    step: 1,
    title: "Morning Arrival & Check In (9:00 AM)",
    description: "Arrive at the office, open STACKZYRO CRM, and click 'Check In' to start your working timer.",
  },
  {
    step: 2,
    title: "Open Dashboard & Review Priorities",
    description: "Inspect the dashboard cards: check 'My Calls Today', 'My Assigned Leads', and 'Pending Follow-ups'.",
  },
  {
    step: 3,
    title: "Review Assigned Leads",
    description: "Open the Leads page and filter by your name. Review prospect business background and requirements.",
  },
  {
    step: 4,
    title: "Research Suitable Businesses",
    description: "Before dialing, review the prospect's website, industry domain, and past CRM notes to tailor your pitch.",
  },
  {
    step: 5,
    title: "Make Professional Business Calls",
    description: "Dial the business contact professionally. Explain STACKZYRO digital solutions and explore requirements.",
  },
  {
    step: 6,
    title: "Record Every Call Immediately",
    description: "Click 'Record Call' right after each conversation. Select the truthful outcome and add clear notes.",
  },
  {
    step: 7,
    title: "Schedule Agreed Follow-ups",
    description: "If the client requested a callback or more information, schedule a follow-up with the exact date and time.",
  },
  {
    step: 8,
    title: "Attend Scheduled Meetings",
    description: "Join Google Meet sessions or attend on-site client discovery meetings punctually. Record minutes.",
  },
  {
    step: 9,
    title: "Update Lead Information",
    description: "Keep contact persons, phone numbers, and service interests up to date based on discussions.",
  },
  {
    step: 10,
    title: "Check Out Whenever Leaving & Check In Upon Return",
    description: "Always Check Out before leaving your desk for lunch, tea, or client visits, and Check In upon returning.",
  },
  {
    step: 11,
    title: "Complete Pending CRM Updates",
    description: "Before finishing your shift, ensure all calls made today have been logged and tomorrow's follow-ups are queued.",
  },
  {
    step: 12,
    title: "Perform Final Check Out (End of Day)",
    description: "Click 'Check Out', select 'End of Day', and confirm. Your daily working and break hours are calculated.",
  },
];

export const FAQ_ITEMS: FAQItem[] = [
  {
    question: "What if I forget my password?",
    answer:
      "For staff members, contact your STACKZYRO Administrator. The Admin will open Staff Management and generate a secure temporary password for your account. You will be prompted to set your own new private password upon your next login. Admins can never see your old password because passwords are encrypted with bcrypt.",
    category: "account",
    roles: ["admin", "staff"],
  },
  {
    question: "How can Admin create a staff account?",
    answer:
      "Go to Settings → Staff Management (or navigate directly to /staff) and click '+ Add Staff'. Fill in the employee's name, unique username, email, phone number, staff code, designation, and temporary password. Then assign their role ('Staff') and select their module permissions using the interactive permission matrix. Click 'Create Staff Member' and provide the login credentials securely to the employee.",
    category: "account",
    roles: ["admin"],
  },
  {
    question: "Why can't I see a particular module (e.g. Proposals or Reports)?",
    answer:
      "STACKZYRO CRM uses granular role-based access control. If a module is missing from your sidebar, your user account has not been granted 'view' permission for that module by the Administrator. If you require access for your job duties, request an Admin to update your module permissions in Staff Management.",
    category: "permissions",
    roles: ["staff"],
  },
  {
    question: "Can staff edit their own attendance records?",
    answer:
      "No. Staff can only record live Check-In and Check-Out events in real time. To maintain payroll and compliance integrity, staff cannot alter past timestamps. If you forgot to check in or out, notify your Administrator immediately. Admins can perform manual corrections, which require a mandatory written justification recorded in the audit logs.",
    category: "attendance",
    roles: ["admin", "staff"],
  },
  {
    question: "What happens if I forget to check out?",
    answer:
      "If you forget to check out, your active session remains open in the system and will be flagged as an incomplete session. Inform your Administrator the next morning. The Admin will open the Attendance History, select your record, edit the session to insert the accurate checkout time, and record an audit correction reason.",
    category: "attendance",
    roles: ["staff", "admin"],
  },
  {
    question: "Can I check in again after checking out?",
    answer:
      "Yes! STACKZYRO CRM is designed for continuous multiple check-in and check-out tracking throughout the working day. You can check out for tea, lunch, or client visits, and check in again upon your return as many times as necessary. Only the final check-out with reason 'End of Day' concludes your shift.",
    category: "attendance",
    roles: ["staff"],
  },
  {
    question: "How are working hours and break hours calculated?",
    answer:
      "Working Time is calculated by summing the duration of all active check-in sessions: sum(check_out_time - check_in_time). Break Time is calculated as the duration between consecutive sessions: sum(next_check_in_time - previous_check_out_time). This ensures fair and transparent calculation of real working hours.",
    category: "attendance",
    roles: ["admin", "staff"],
  },
  {
    question: "How do I record a client call?",
    answer:
      "Go to Call Management and click '+ Record Call' (or click the phone icon on any lead row in the Leads table). Select the Lead, verify the timestamp, choose an honest outcome (e.g. Interested, Call Back Requested, Not Taken), write detailed discussion notes, and optionally toggle 'Schedule follow-up' to queue your next action. Click 'Save Call Record'.",
    category: "calls",
    roles: ["staff", "admin"],
  },
  {
    question: "Can I contact a lead again after they decline?",
    answer:
      "If a client expresses that they are not interested at this time, you may schedule a polite follow-up a few months later if agreed. However, if the client explicitly requests not to be contacted or declines firmly, the outcome must be marked 'Do Not Contact'. Staff must strictly respect client requests and never repeatedly harass unwilling businesses.",
    category: "leads",
    roles: ["staff", "admin"],
  },
  {
    question: "Who approves proposals and quotations?",
    answer:
      "Proposals are drafted by staff or admins using STACKZYRO's official service templates. Once prepared, staff submit the proposal in 'Pending Approval' status. Only Administrators have the authority to review commercial scopes, verify pricing and margins, and officially approve proposals before they can be sent to clients.",
    category: "proposals",
    roles: ["admin", "staff"],
  },
  {
    question: "How do I schedule a meeting?",
    answer:
      "Navigate to Meetings (/meetings) and click '+ Schedule Meeting'. Pick the Lead, select the meeting type (Google Meet, On-site, or Phone), set the scheduled date and time, duration in minutes, and assign the responsible staff member. If Google Meet is selected, paste the Google Meet conference URL so team members can join with 1 click.",
    category: "leads",
    roles: ["admin", "staff"],
  },
  {
    question: "How do I convert an accepted lead into a client?",
    answer:
      "Once a lead agrees to contract terms or their proposal status is marked 'Accepted', an Admin can click 'Convert to Client' from the Lead action menu. The system creates a permanent Client record with an assigned client code (e.g. CLI-009) while preserving all historical call and meeting records.",
    category: "leads",
    roles: ["admin"],
  },
  {
    question: "Why can't Admins view existing employee passwords?",
    answer:
      "All passwords in STACKZYRO CRM are cryptographically hashed using one-way bcrypt hashing with salt. The system never stores plain-text passwords. This industry-standard security measure protects employee privacy and prevents credential leakage even in the event of an internal audit.",
    category: "account",
    roles: ["admin", "staff"],
  },
  {
    question: "How do the Daily and Monthly attendance CSV reports work?",
    answer:
      "Admins can go to Attendance → Reports tab and select either Daily Attendance Report or Monthly Attendance Report. The Daily Report exports every employee's exact session breakdown, check-in/out timestamps, and reasons. The Monthly Report generates a staff matrix summarizing present days, total working hours, total break hours, and exit frequencies.",
    category: "attendance",
    roles: ["admin"],
  },
  {
    question: "What is the difference between a temporary check-out and End of Day?",
    answer:
      "A temporary check-out (such as Lunch Break, Tea Break, Client Meeting, or Business Visit) pauses your working timer while you are away from the office. You are expected to Check In again upon return. 'End of Day' indicates the completion of your entire working shift for the date.",
    category: "attendance",
    roles: ["staff"],
  },
];

export const TROUBLESHOOTING_GUIDE: TroubleshootingItem[] = [
  {
    id: "ts-login",
    issue: "Unable to log in / Invalid credentials error",
    symptom: "Login form displays 'Invalid username or password' or denies access.",
    cause:
      "Typo in username or password, account has been deactivated/suspended by Admin, or caps lock is enabled.",
    resolution: [
      "Check Caps Lock and ensure no accidental spaces were pasted before or after the username.",
      "If you are using temporary credentials, ensure you are copying the exact characters.",
      "Ask your Administrator to verify in Staff Management that your account status is 'Active' and not 'Suspended' or 'Inactive'.",
      "If the password is forgotten, ask Admin to trigger a temporary password reset.",
    ],
    role: "both",
  },
  {
    id: "ts-permission",
    issue: "Module or page displays 'Access Denied' / Not visible in navigation",
    symptom: "Sidebar does not show the requested module, or visiting a direct URL redirects to 403 / Dashboard.",
    cause:
      "Your staff user profile does not have the necessary permission flag for that specific module.",
    resolution: [
      "Verify with your Administrator which modules your role requires for daily duties.",
      "Admin must open Staff Management (/staff), click 'Edit' on your account, navigate to Module Permissions, and check the required actions (e.g. 'view', 'create').",
      "Refresh your browser session (Ctrl + F5) or log out and log back in to reload your permissions token.",
    ],
    role: "staff",
  },
  {
    id: "ts-attendance-missed",
    issue: "Forgot to check out before leaving or forgot to check in upon arrival",
    symptom: "Attendance status shows 'Checked In' while at home, or working timer did not start in the morning.",
    cause:
      "Employee closed browser without pressing Check Out, or arrived at work without opening CRM.",
    resolution: [
      "Do not try to manipulate browser cookies or alter timestamps yourself.",
      "Immediately message your Administrator detailing your actual arrival/departure time and the reason.",
      "Admin opens Attendance → Live Board or History tab, clicks 'Edit/Correct Session' on your name.",
      "Admin inputs the correct timestamp and enters a mandatory correction explanation.",
    ],
    role: "both",
  },
  {
    id: "ts-proposal-approval",
    issue: "Proposal cannot be sent to client / stuck in 'Pending Approval'",
    symptom: "Staff member cannot find the 'Send Proposal' or 'Mark Accepted' option.",
    cause:
      "Proposals must be authorized by an Administrator before they can be officially dispatched or marked accepted.",
    resolution: [
      "Staff must inform the Administrator that a proposal draft is ready for commercial review.",
      "Admin opens Proposals (/proposals), inspects the quotation preview, verifies pricing margins, and clicks 'Approve'.",
      "Once approved, the proposal can be downloaded as PDF or sent to the prospective client.",
    ],
    role: "both",
  },
  {
    id: "ts-meet-link",
    issue: "Google Meet link does not open or shows invalid URL",
    symptom: "Clicking 'Join Google Meet' button produces an error or opens a broken page.",
    cause:
      "Meeting was scheduled with an incomplete URL (e.g. missing 'https://' or invalid meeting code).",
    resolution: [
      "Open the Meetings module and click 'Edit' on the affected meeting row.",
      "Ensure the Google Meet link follows the standard format: https://meet.google.com/xxx-yyyy-zzz.",
      "Save the meeting. Team members can now join with 1 click.",
    ],
    role: "both",
  },
  {
    id: "ts-duplicate-calls",
    issue: "Concern about creating duplicate leads when calling clients multiple times",
    symptom: "Unsure whether to create a new lead for a follow-up phone conversation.",
    cause: "Misunderstanding of CRM data architecture.",
    resolution: [
      "NEVER create a new lead for repeat calls to the same business.",
      "Always open the existing lead from Leads or Call Management and click 'Record Call'.",
      "Calls attach to the parent lead history, creating a sequential communication timeline without duplicating records.",
    ],
    role: "staff",
  },
  {
    id: "ts-csv-export",
    issue: "CSV Export download blocked or empty file generated",
    symptom: "Browser prompts download warning or exported CSV contains 0 rows.",
    cause:
      "Active search/date filters excluded all records, or browser popup blocker intercepted file download.",
    resolution: [
      "Check your search and date filters on the page before exporting (e.g. reset Status to 'All').",
      "Ensure your browser allows file downloads from the CRM domain.",
      "For Attendance CSV reports, ensure the selected date range contains recorded sessions.",
    ],
    role: "both",
  },
  {
    id: "ts-browser-cache",
    issue: "UI does not reflect recent changes or displays stale data",
    symptom: "A lead or proposal was updated by a colleague but still appears unchanged.",
    cause: "Aggressive browser caching of frontend static assets.",
    resolution: [
      "Perform a hard refresh: Press Ctrl + Shift + R (Windows) or Cmd + Shift + R (Mac).",
      "Alternatively, click the Refresh icon on the page table header.",
      "Clear browser cache if changes persist.",
    ],
    role: "both",
  },
];
