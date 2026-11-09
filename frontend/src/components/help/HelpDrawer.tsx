import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { MODULE_DOCS } from "../../lib/helpContent";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  moduleKey: string;
}

export function HelpDrawer({ open, onClose, moduleKey }: HelpDrawerProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const doc = MODULE_DOCS[moduleKey];

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !doc) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <aside className="pop-enter flex w-screen max-w-md flex-col border-l border-line bg-white shadow-pop">
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-line bg-gradient-to-r from-[#faf8ff] to-white px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <BookOpen className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <Badge tone="purple">In-App Manual</Badge>
                  <span className="text-[10.5px] capitalize text-ink-400">
                    {isAdmin ? "Admin View" : "Staff View"}
                  </span>
                </div>
                <h3 className="mt-0.5 text-sm font-bold text-ink-900">{doc.title}</h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-canvas hover:text-ink-700"
              aria-label="Close manual drawer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Short overview */}
            <p className="text-xs leading-relaxed text-ink-600 bg-canvas p-3 rounded-xl border border-line">
              {doc.shortDescription}
            </p>

            {/* Role Responsibilities */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-900">
                {isAdmin ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-brand-600" />
                    Admin Responsibilities
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                    Staff Responsibilities
                  </>
                )}
              </h4>
              <ul className="space-y-2">
                {(isAdmin ? doc.adminResponsibilities : doc.staffResponsibilities).map(
                  (resp, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-ink-700">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                      <span>{resp}</span>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Step-by-Step Instructions */}
            {doc.workflowSteps && doc.workflowSteps.length > 0 ? (
              <div className="space-y-3 pt-2 border-t border-line">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-900">
                  Step-by-Step Workflow
                </h4>
                <div className="space-y-3">
                  {doc.workflowSteps.map((step) => (
                    <div
                      key={step.step}
                      className="rounded-xl border border-line bg-canvas/60 p-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                          {step.step}
                        </span>
                        <p className="font-semibold text-ink-900">{step.title}</p>
                      </div>
                      <p className="mt-1.5 text-ink-600 leading-relaxed pl-7">
                        {step.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Best practices */}
            {doc.bestPractices && doc.bestPractices.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-line">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-900">
                  Do's & Don'ts
                </h4>
                <ul className="space-y-1.5">
                  {doc.bestPractices.map((practice, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-ink-600">
                      <span className="text-brand-500 font-bold">•</span>
                      <span>{practice}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Drawer Footer */}
          <div className="border-t border-line bg-canvas p-4 flex items-center justify-between">
            <Link
              to={`/help?module=${doc.key}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
            >
              <span>Open in Help Centre</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </aside>
      </div>
    </div>,
    document.body
  );
}
