import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export interface TourStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  path: string;
  elementHint: string;
  badge: string;
  role: "admin" | "staff" | "both";
  keyHighlights: string[];
}

export const ADMIN_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to STACKZYRO CRM",
    subtitle: "Enterprise Overview & Operational Architecture",
    description:
      "STACKZYRO CRM is built for turning ideas into digital solutions. As an Administrator, you have complete visibility over leads, sales pipelines, client proposals, continuous attendance, staff performance and security audit trails.",
    path: "/dashboard",
    elementHint: "Workspace Header & Executive Summary",
    badge: "Step 1 of 12",
    role: "admin",
    keyHighlights: [
      "Real-time dynamic calculations without hardcoded values",
      "Integrated pipeline from raw enquiry to paid client project",
      "Continuous workplace attendance tracking with live board",
    ],
  },
  {
    id: "dashboard",
    title: "Executive Dashboard & Operational Pulse",
    subtitle: "Real-time Metrics, Pipeline Funnels & Live Board",
    description:
      "Your dashboard calculates all vital business indicators: Total Leads, New Leads, Interested Prospects, Pending Follow-ups, Proposals Sent, Converted Clients, and Today's Attendance live board.",
    path: "/dashboard",
    elementHint: "Dashboard Metric Cards & Charts",
    badge: "Step 2 of 12",
    role: "admin",
    keyHighlights: [
      "Compare metrics with 7-day, 30-day, and 90-day presets",
      "Monitor staff presence in real time (working, on break, absent)",
      "Instant live activity stream of all CRM events",
    ],
  },
  {
    id: "staff-mgmt",
    title: "Staff & User Management",
    subtitle: "10-Step Secure Provisioning & Account Administration",
    description:
      "Create and provision unique staff accounts. Set unique usernames, temporary passwords with forced change on first login, and manage employment details without ever viewing plain passwords.",
    path: "/staff",
    elementHint: "Staff Management Table & '+ Add Staff' Button",
    badge: "Step 3 of 12",
    role: "admin",
    keyHighlights: [
      "Bcrypt cryptographic hashing for complete credential security",
      "Forced password change on employee's first login",
      "Non-destructive deactivation preserving historical call logs",
    ],
  },
  {
    id: "permissions",
    title: "Roles & Granular Permissions",
    subtitle: "Principle of Least Privilege & Access Matrices",
    description:
      "Assign custom action rights per module: View, Create, Edit, Delete, Export, Approve, and Assign. Tailor access for Office Assistants, Business Development, Web Developers, and Marketers.",
    path: "/staff",
    elementHint: "Module Permission Checkbox Matrix",
    badge: "Step 4 of 12",
    role: "admin",
    keyHighlights: [
      "Strict separation of operational staff from administrative secrets",
      "Proposal approval rights restricted to authorized leaders",
      "Audit trail logs all permission modifications",
    ],
  },
  {
    id: "leads",
    title: "Lead Acquisition & Pipeline Flow",
    subtitle: "Centralized Lead Records & Assignment",
    description:
      "Manage all incoming prospects from website, cold calls, referrals, and ads. Assign leads to staff members and track status from New to Converted with zero duplicate entries.",
    path: "/leads",
    elementHint: "Leads Table, Status Badges & Quick Action Menu",
    badge: "Step 5 of 12",
    role: "admin",
    keyHighlights: [
      "Every call, proposal, and meeting attaches to the lead history",
      "Direct 1-click conversion to permanent Client account",
      "Multi-service interest tagging and CSV export",
    ],
  },
  {
    id: "calls",
    title: "Call Management & Audit Trail",
    subtitle: "Communication Records & Customer Outcomes",
    description:
      "Review the comprehensive log of every client conversation. Each call record captures the exact outcome (Interested, Not Taken, Call Back Requested, etc.), caller ID, and timestamp.",
    path: "/calls",
    elementHint: "Call Logs Table & Record Call Modal",
    badge: "Step 6 of 12",
    role: "admin",
    keyHighlights: [
      "Each conversation has its own record—never overwriting history",
      "Automatic follow-up scheduling integrated into call recording",
      "Team-wide daily call volume and outcome distributions",
    ],
  },
  {
    id: "followups",
    title: "Follow-ups & Commitment Deadlines",
    subtitle: "Task Execution & Overdue Prevention",
    description:
      "Ensure zero opportunities slip through the cracks. Monitor pending and overdue follow-up touchpoints across phone, WhatsApp, email, and meetings.",
    path: "/followups",
    elementHint: "Follow-ups Queue & Completion Checkmarks",
    badge: "Step 7 of 12",
    role: "admin",
    keyHighlights: [
      "High-contrast badges highlight overdue follow-up deadlines",
      "Enforce ethical contact: never follow up with clients who declined",
      "Completion notes record the next agreed action immediately",
    ],
  },
  {
    id: "proposals",
    title: "Proposals & Commercial Quotations",
    subtitle: "Official Templates, Scopes & Approval Workflow",
    description:
      "Create high-impact technical proposals using STACKZYRO templates. Staff prepare drafts, and Admins review scopes, deliverables, timelines, and margins before approving them for client transmission.",
    path: "/proposals",
    elementHint: "Proposals Table, Status Badges & PDF Preview",
    badge: "Step 8 of 12",
    role: "admin",
    keyHighlights: [
      "Official templates for Corporate Website, Web App, Custom Software",
      "Interactive pricing matrices with automated subtotal and tax math",
      "Print and PDF export ready for client delivery",
    ],
  },
  {
    id: "meetings",
    title: "Client Meetings & Video Conferences",
    subtitle: "Google Meet Coordination & Handover",
    description:
      "Coordinate discovery meetings and technical presentations. Attach Google Meet conference links, assign meeting owners, and document meeting minutes for engineering handoff.",
    path: "/meetings",
    elementHint: "Meeting Schedule & 1-Click Join Link",
    badge: "Step 9 of 12",
    role: "admin",
    keyHighlights: [
      "1-click direct link to open Google Meet conferences",
      "Log detailed requirements discussed during the session",
      "Seamless handover from sales to technical delivery team",
    ],
  },
  {
    id: "attendance",
    title: "Continuous Multiple Check-In/Out Attendance",
    subtitle: "Live Status Board, Break Tracking & Admin Corrections",
    description:
      "STACKZYRO CRM tracks multiple check-in/out events per day. Monitor live staff status (Working, On Break, Absent), view break reasons (Lunch, Client Visit), and perform documented corrections with audit reasons.",
    path: "/attendance",
    elementHint: "Live Status Board, Daily Sessions & Export CSV",
    badge: "Step 10 of 12",
    role: "admin",
    keyHighlights: [
      "Accurate session-based math for Working vs Break duration",
      "Mandatory written reasons required for any Admin correction",
      "Export daily session breakdowns and monthly staff matrices to CSV",
    ],
  },
  {
    id: "reports",
    title: "Business Intelligence & Staff Analytics",
    subtitle: "Performance Rankings, Pipeline Health & Reports",
    description:
      "Gain deep insights into company operations. Analyze lead sources, staff call leaderboards, conversion rates, and generate comprehensive attendance reports.",
    path: "/reports",
    elementHint: "Analytics Presets, Staff Performance Table & Charts",
    badge: "Step 11 of 12",
    role: "admin",
    keyHighlights: [
      "8 distinct report views with custom date range selectors",
      "Individual staff productivity rankings (calls, follow-ups, present days)",
      "Instant CSV downloads for executive reviews and payroll",
    ],
  },
  {
    id: "help-centre",
    title: "Integrated Help Centre & Documentation",
    subtitle: "In-App User Manuals, Guides & Interactive Resources",
    description:
      "Need a quick reference? Open the Help Centre anytime to access complete Admin and Staff manuals, step-by-step guides, attendance rules, FAQs, and troubleshooting articles.",
    path: "/help",
    elementHint: "Help Centre Navigation & Search Filter",
    badge: "Step 12 of 12",
    role: "admin",
    keyHighlights: [
      "Full role-based manuals for Admin and Staff",
      "Real-time search across all topics and FAQs",
      "Restart this interactive tour at any time with 1 click",
    ],
  },
];

export const STAFF_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome-staff",
    title: "Welcome to STACKZYRO CRM",
    subtitle: "Your Digital Workspace & Daily Workflow",
    description:
      "Welcome to the team! STACKZYRO CRM is designed to help you manage leads, make professional business calls, schedule follow-ups, and log your daily work effortlessly.",
    path: "/dashboard",
    elementHint: "Personal Workspace Header",
    badge: "Step 1 of 8",
    role: "staff",
    keyHighlights: [
      "Everything you need to succeed in your assigned responsibilities",
      "Zero confusing clutter: you only see modules permitted for your role",
      "Continuous attendance tracking with 1-click check in/out",
    ],
  },
  {
    id: "attendance-staff",
    title: "Continuous Daily Attendance",
    subtitle: "Multiple Check-In & Check-Out System",
    description:
      "Attendance is continuous throughout the day. Check In when you arrive, Check Out when you step out (Lunch, Tea, Client Visit), Check In when you return, and perform your final Check Out at End of Day.",
    path: "/attendance",
    elementHint: "Attendance Card & Check In/Out Buttons",
    badge: "Step 2 of 8",
    role: "staff",
    keyHighlights: [
      "Press 'Check In' to start your working timer upon arrival",
      "Select the truthful reason when leaving (Lunch Break, Client Meeting, etc.)",
      "Never ask colleagues to check in for you—proxy attendance is prohibited",
    ],
  },
  {
    id: "dashboard-staff",
    title: "Your Personal Dashboard",
    subtitle: "Today's Priorities & Action List",
    description:
      "Your dashboard summarizes your active workload: 'My Assigned Leads', 'My Calls Today', 'Pending Follow-ups', and 'Scheduled Meetings'. Check this first thing every morning.",
    path: "/dashboard",
    elementHint: "Staff Summary Cards & Follow-ups Widget",
    badge: "Step 3 of 8",
    role: "staff",
    keyHighlights: [
      "Review calls made today against your daily goals",
      "Check upcoming follow-ups so no client commitment is missed",
      "Direct links to jump right into your assigned tasks",
    ],
  },
  {
    id: "leads-staff",
    title: "Managing Assigned Leads",
    subtitle: "Prospect Research & Professional Outreach",
    description:
      "Open Leads to view businesses assigned to you. Inspect their requirements and background notes before calling. Update their status honestly—never invent requirements.",
    path: "/leads",
    elementHint: "Leads Table & Lead Detail Modal",
    badge: "Step 4 of 8",
    role: "staff",
    keyHighlights: [
      "Click the eye icon to view complete business requirements and history",
      "Keep contact information and decision-maker details up to date",
      "Never mark a lead converted without formal client confirmation",
    ],
  },
  {
    id: "calls-staff",
    title: "Recording Business Calls",
    subtitle: "Conversation Outcomes & Accurate Notes",
    description:
      "Log every phone conversation immediately after hanging up. Select the accurate outcome (Interested, Call Back Requested, Not Taken, etc.) and write clear, helpful notes.",
    path: "/calls",
    elementHint: "Record Call Modal & Outcome Selector",
    badge: "Step 5 of 8",
    role: "staff",
    keyHighlights: [
      "Always log 'Not Taken' calls so colleagues know an attempt was made",
      "Write concise notes capturing client objections or technical needs",
      "Schedule the next follow-up in the same window with 1 click",
    ],
  },
  {
    id: "followups-staff",
    title: "Executing Agreed Follow-ups",
    subtitle: "Timely Client Touchpoints",
    description:
      "Review your pending follow-ups daily. Reach out via the agreed method (Phone, WhatsApp, Email, or Meeting) on time, mark the task completed, and queue the next action.",
    path: "/followups",
    elementHint: "Follow-ups List & Complete Task Modal",
    badge: "Step 6 of 8",
    role: "staff",
    keyHighlights: [
      "Punctuality builds corporate trust and closes deals faster",
      "If a client requested 'Do Not Contact', respect their decision strictly",
      "Document what was agreed in the completion note",
    ],
  },
  {
    id: "meetings-staff",
    title: "Client Meetings & Video Conferences",
    subtitle: "Google Meet & Discovery Sessions",
    description:
      "View your scheduled client discovery sessions. Click 'Join Google Meet' directly from the CRM, conduct a professional consultation, and record meeting minutes.",
    path: "/meetings",
    elementHint: "Meetings Table & Google Meet Button",
    badge: "Step 7 of 8",
    role: "staff",
    keyHighlights: [
      "Prepare technical questions and review lead notes prior to the meeting",
      "Join 5 minutes early to test your audio and presentation materials",
      "Mark status 'Completed' and hand over details to the project team",
    ],
  },
  {
    id: "help-staff",
    title: "In-App Help Centre & Daily Routine",
    subtitle: "Manuals, FAQs & Step-by-Step Guidance",
    description:
      "Whenever you have a question about how a module works, open the Help Centre. It contains your complete Staff User Guide, the 12-Step Daily Routine, and helpful FAQs.",
    path: "/help",
    elementHint: "Help Centre & Search Bar",
    badge: "Step 8 of 8",
    role: "staff",
    keyHighlights: [
      "Step-by-step guides for every task in the CRM",
      "Complete answers to frequently asked questions",
      "Restart this interactive walkthrough anytime from Help Centre",
    ],
  },
];

interface TourContextValue {
  isTourOpen: boolean;
  currentStepIndex: number;
  currentStep: TourStep;
  totalSteps: number;
  steps: TourStep[];
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  finishTour: () => void;
  restartTour: () => void;
  hasCompletedTour: boolean;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const storageKey = useMemo(() => {
    return user ? `stackzyro_tour_completed_${user.id}` : null;
  }, [user]);

  const [hasCompletedTour, setHasCompletedTour] = useState<boolean>(true);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps = useMemo(() => {
    if (user?.role === "admin") {
      return ADMIN_TOUR_STEPS;
    }
    return STAFF_TOUR_STEPS;
  }, [user?.role]);

  // Check if first-time user
  useEffect(() => {
    if (!storageKey) return;
    const completed = localStorage.getItem(storageKey);
    if (completed === "true") {
      setHasCompletedTour(true);
    } else {
      setHasCompletedTour(false);
      // Auto-trigger tour on first login after short delay
      const timer = window.setTimeout(() => {
        setIsTourOpen(true);
        setCurrentStepIndex(0);
      }, 1200);
      return () => window.clearTimeout(timer);
    }
  }, [storageKey]);

  const currentStep = steps[currentStepIndex] || steps[0];

  const startTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsTourOpen(true);
    if (steps[0]?.path) {
      navigate(steps[0].path);
    }
  }, [steps, navigate]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      if (steps[nextIdx]?.path) {
        navigate(steps[nextIdx].path);
      }
    } else {
      finishTour();
    }
  }, [currentStepIndex, steps, navigate]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      if (steps[prevIdx]?.path) {
        navigate(steps[prevIdx].path);
      }
    }
  }, [currentStepIndex, steps, navigate]);

  const skipTour = useCallback(() => {
    setIsTourOpen(false);
    if (storageKey) {
      localStorage.setItem(storageKey, "true");
      setHasCompletedTour(true);
    }
  }, [storageKey]);

  const finishTour = useCallback(() => {
    setIsTourOpen(false);
    if (storageKey) {
      localStorage.setItem(storageKey, "true");
      setHasCompletedTour(true);
    }
  }, [storageKey]);

  const restartTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsTourOpen(true);
    if (steps[0]?.path) {
      navigate(steps[0].path);
    }
  }, [steps, navigate]);

  return (
    <TourContext.Provider
      value={{
        isTourOpen,
        currentStepIndex,
        currentStep,
        totalSteps: steps.length,
        steps,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        finishTour,
        restartTour,
        hasCompletedTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}
