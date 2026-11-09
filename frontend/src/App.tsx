import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { MetaProvider } from "./context/MetaContext";
import { ToastProvider } from "./context/ToastContext";
import { TourProvider } from "./context/TourContext";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth, RequirePermission, RequireRole } from "./components/layout/ProtectedRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Leads } from "./pages/Leads";
import { Calls } from "./pages/Calls";
import { FollowUps } from "./pages/FollowUps";
import { Proposals } from "./pages/Proposals";
import { CreateProposal } from "./pages/CreateProposal";
import { ProposalEditor } from "./pages/ProposalEditor";
import { ProposalPreview } from "./pages/ProposalPreview";
import { Meetings } from "./pages/Meetings";
import { Clients } from "./pages/Clients";
import { AttendancePage } from "./pages/Attendance";
import Messages from "./pages/Messages";
import { StaffManagement } from "./pages/StaffManagement";
import { Reports } from "./pages/Reports";
import { SettingsPage } from "./pages/Settings";
import { HelpCentre } from "./pages/HelpCentre";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <TourProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route
                path="/proposals/:id/preview"
                element={
                  <MetaProvider>
                    <ProposalPreview />
                  </MetaProvider>
                }
              />
              <Route
                element={
                  <MetaProvider>
                    <AppShell />
                  </MetaProvider>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                
                <Route element={<RequirePermission module="leads" />}>
                  <Route path="/leads" element={<Leads />} />
                </Route>

                <Route element={<RequirePermission module="calls" />}>
                  <Route path="/calls" element={<Calls />} />
                </Route>

                <Route element={<RequirePermission module="followups" />}>
                  <Route path="/followups" element={<FollowUps />} />
                </Route>

                <Route element={<RequirePermission module="proposals" />}>
                  <Route path="/proposals" element={<Proposals />} />
                  <Route path="/proposals/new" element={<CreateProposal />} />
                  <Route path="/proposals/:id/edit" element={<ProposalEditor />} />
                </Route>

                <Route element={<RequirePermission module="meetings" />}>
                  <Route path="/meetings" element={<Meetings />} />
                </Route>

                <Route element={<RequirePermission module="clients" />}>
                  <Route path="/clients" element={<Clients />} />
                </Route>

                <Route element={<RequirePermission module="attendance" />}>
                  <Route path="/attendance" element={<AttendancePage />} />
                </Route>

                <Route element={<RequirePermission module="messages" />}>
                  <Route path="/messages" element={<Messages />} />
                </Route>

                <Route element={<RequirePermission module="settings" />}>
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>

                <Route element={<RequireRole role="admin" />}>
                  <Route path="/staff" element={<StaffManagement />} />
                </Route>

                <Route element={<RequirePermission module="reports" />}>
                  <Route path="/reports" element={<Reports />} />
                </Route>

                <Route path="/help" element={<HelpCentre />} />

                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </Routes>
        </TourProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
