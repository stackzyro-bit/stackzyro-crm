import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/ui/Logo";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { cn } from "../lib/format";

const VALUE_PROPOSITIONS = [
  {
    title: "Granular Access & Permissions",
    description: "Multi-tier security ensuring employees only view their assigned leads, calls, and metrics.",
  },
  {
    title: "Enterprise Pipeline Tracking",
    description: "Real-time visibility from first phone enquiry to proposal delivery and client onboarding.",
  },
  {
    title: "Audit Trail & Compliance",
    description: "Every account change, status update, and activity is immutably logged for total transparency.",
  },
];

export function Login() {
  const { user, login, mustChangePassword, submitFirstPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});

  // Forgot password modal
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotIdent, setForgotIdent] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // First-time password change modal state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [firstChangeLoading, setFirstChangeLoading] = useState(false);
  const [firstChangeError, setFirstChangeError] = useState<string | null>(null);

  if (user && !mustChangePassword) return <Navigate to="/dashboard" replace />;

  const from = (location.state as { from?: string } | null)?.from;

  const validate = () => {
    const errors: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) {
      errors.identifier = "Enter your work email address or username.";
    }
    if (!password) {
      errors.password = "Enter your password.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const account = await login(identifier.trim(), password, remember);
      if (!account.must_change_password) {
        navigate(from && from !== "/login" ? from : "/dashboard", {
          replace: true,
          state: { welcome: account.name },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const onForgotPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    if (!forgotIdent.trim()) {
      setForgotError("Please enter your email or username.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await api.post<{ message: string }>("/auth/forgot-password", {
        username_or_email: forgotIdent.trim(),
      });
      setForgotSuccess(res.message);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setForgotLoading(false);
    }
  };

  const onFirstPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFirstChangeError(null);
    if (newPassword.length < 8) {
      setFirstChangeError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setFirstChangeError("Password must include at least one letter and one number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFirstChangeError("Passwords do not match.");
      return;
    }

    setFirstChangeLoading(true);
    try {
      await submitFirstPassword(newPassword, confirmPassword);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setFirstChangeError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setFirstChangeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Left Branding Side Panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-50 px-14 py-12 lg:flex">
        {/* Subtle geometric light lavender accents */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-[400px] w-[400px] rounded-full border border-brand-200/50 bg-gradient-to-b from-brand-100/30 to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-16 h-[260px] w-[260px] rounded-full border border-brand-200/40"
          aria-hidden="true"
        />

        <div>
          <Logo />
        </div>

        <div className="relative max-w-[480px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/90 px-3.5 py-1.5 shadow-xs backdrop-blur-xs">
            <ShieldCheck className="h-4 w-4 text-brand-600" />
            <span className="text-[11.5px] font-semibold tracking-wide text-brand-700">
              SECURE ENTERPRISE CRM
            </span>
          </div>

          <h1 className="mt-5 text-[36px] font-semibold leading-[1.18] tracking-[-0.03em] text-ink-900">
            Turning Ideas Into Digital Solutions.
          </h1>
          <p className="mt-3.5 text-[14px] leading-relaxed text-ink-600">
            A secure business operations platform for STACKZYRO. Orchestrate your team, convert high-value leads, and maintain total visibility over proposals and client contracts.
          </p>

          <div className="mt-8 space-y-3">
            {VALUE_PROPOSITIONS.map((prop) => (
              <div
                key={prop.title}
                className="flex items-start gap-3.5 rounded-xl border border-brand-100/80 bg-white/90 p-4 shadow-xs backdrop-blur-xs transition-shadow hover:shadow-card"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100/70 text-brand-700">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-ink-900">{prop.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">
                    {prop.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-brand-200/60 pt-5 text-[11.5px] text-ink-500">
          <span>© {new Date().getFullYear()} STACKZYRO Technologies</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-brand-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            System Secure & Online
          </span>
        </div>
      </aside>

      {/* Right Login Form */}
      <main className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10 lg:px-16 bg-white">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <div>
            <span className="inline-block rounded-md bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700 border border-brand-100">
              Authorized Access Only
            </span>
            <h2 className="mt-3 text-[26px] font-semibold tracking-[-0.025em] text-ink-900">
              Sign in to STACKZYRO CRM
            </h2>
            <p className="mt-1.5 text-[13px] text-ink-500">
              Enter your work email or username to access your workspace.
            </p>
          </div>

          {error ? (
            <div
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-[12px] leading-relaxed text-rose-800"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4.5" noValidate>
            <div>
              <label htmlFor="identifier" className="mb-1.5 block text-[12.5px] font-medium text-ink-700">
                Email or Username
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (fieldErrors.identifier) setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                  }}
                  placeholder="name@stackzyro.com or username"
                  className={cn(
                    "h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3.5 text-[13.5px] text-ink-900 placeholder:text-ink-400 transition-all focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 shadow-xs",
                    fieldErrors.identifier && "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
                  )}
                  aria-invalid={Boolean(fieldErrors.identifier)}
                  disabled={loading}
                />
              </div>
              {fieldErrors.identifier ? (
                <p className="mt-1.5 text-[11.5px] font-medium text-rose-600">{fieldErrors.identifier}</p>
              ) : null}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-[12.5px] font-medium text-ink-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotError(null);
                    setForgotSuccess(null);
                    setForgotIdent(identifier);
                    setForgotOpen(true);
                  }}
                  className="text-[12px] font-medium text-brand-600 hover:text-brand-700 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="Enter your account password"
                  className={cn(
                    "h-11 w-full rounded-xl border border-line bg-white pl-10 pr-11 text-[13.5px] text-ink-900 placeholder:text-ink-400 transition-all focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 shadow-xs",
                    fieldErrors.password && "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
                  )}
                  aria-invalid={Boolean(fieldErrors.password)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-400 transition-colors hover:text-ink-700 hover:bg-canvas"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password ? (
                <p className="mt-1.5 text-[11.5px] font-medium text-rose-600">{fieldErrors.password}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between py-1">
              <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px] text-ink-600 select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded-md border-line text-brand-600 accent-brand-600 focus:ring-brand-500"
                />
                Remember me for 14 days
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-[13.5px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand-300 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying credentials…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-line bg-brand-50/50 p-4 text-center">
            <p className="text-[11.5px] text-ink-500 leading-relaxed">
              Protected by bcrypt password hashing, session revocation, and automated threat monitoring. Account lockouts trigger after repeated failed attempts.
            </p>
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Account Recovery Assistance"
        description="Submit your username or registered work email to request a secure password reset from your system administrator."
        size="sm"
      >
        {forgotSuccess ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[12.5px] text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900">Request Logged Successfully</p>
                <p className="mt-1 leading-relaxed">{forgotSuccess}</p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setForgotOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onForgotPasswordSubmit} className="space-y-4 py-2">
            {forgotError ? (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            ) : null}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-700">
                Work Email or Username
              </label>
              <input
                type="text"
                value={forgotIdent}
                onChange={(e) => setForgotIdent(e.target.value)}
                placeholder="e.g. admin@stackzyro.com or username"
                className="h-10 w-full rounded-lg border border-line px-3 text-[13px] text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100"
                autoFocus
              />
            </div>

            <p className="text-[11px] text-ink-400 leading-relaxed">
              Your administrator will verify your identity and generate a temporary password for your next login.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button variant="outline" type="button" onClick={() => setForgotOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={forgotLoading}>
                Submit Request
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Mandatory First-Time Password Change Modal */}
      <Modal
        open={mustChangePassword}
        onClose={() => {}}
        title="Staff First Login: Set Permanent Password"
        description="Your administrator configured your account with an initial password. Please establish your private permanent password before accessing your CRM modules."
        size="md"
      >
        <form onSubmit={onFirstPasswordSubmit} className="space-y-4 py-2">
          {firstChangeError ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{firstChangeError}</span>
            </div>
          ) : null}

          <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3.5 text-[11.5px] text-brand-900 leading-relaxed">
            <span className="font-semibold">Security Requirement:</span> Permanent passwords must be at least 8 characters long and contain both letters and numeric digits.
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-700">
              New Permanent Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new permanent password"
                className="h-10 w-full rounded-lg border border-line px-3 pr-10 text-[13px] text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-700">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-type new permanent password"
              className="h-10 w-full rounded-lg border border-line px-3 text-[13px] text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100"
              required
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" loading={firstChangeLoading} leftIcon={<KeyRound className="h-4 w-4" />}>
              Save Permanent Password & Continue
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
