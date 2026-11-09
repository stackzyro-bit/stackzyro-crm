import { Loader2, ShieldAlert } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Logo } from "../ui/Logo";
import { hasPermission, type Role } from "../../lib/types";

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas">
      <Logo />
      <div className="flex items-center gap-2 text-xs text-ink-400">
        <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
        Loading your workspace…
      </div>
    </div>
  );
}

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role !== role) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function RequirePermission({
  module,
  action = "view",
}: {
  module: string;
  action?: string;
}) {
  const { user } = useAuth();
  if (!user) return null;
  if (!hasPermission(user, module, action)) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-line bg-white p-8 text-center shadow-card">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-ink-900">Access Restricted</h2>
        <p className="mt-1 max-w-md text-xs text-ink-500">
          You do not have administrative authorization or assigned permissions to access the {module} module. Please contact your CRM administrator if you require access.
        </p>
      </div>
    );
  }
  return <Outlet />;
}
