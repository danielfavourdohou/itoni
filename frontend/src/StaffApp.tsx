import { Route, Routes, useLocation } from "react-router-dom";

import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { ErrorState, LoadingState } from "./components/StateViews";
import { AuthProvider, useAuth } from "./lib/auth";
import { Landing } from "./pages/Landing";
import { NotFound } from "./pages/NotFound";
import { Dashboard } from "./pages/staff/Dashboard";
import { Inbox } from "./pages/staff/Inbox";
import { InstructionDetail } from "./pages/staff/InstructionDetail";
import { Login } from "./pages/staff/Login";
import { NewInstruction } from "./pages/staff/NewInstruction";
import { Translations } from "./pages/staff/Translations";
import { Usage } from "./pages/staff/Usage";

function StaffRoutes() {
  const { status, loadError, retry, user } = useAuth();
  const location = useLocation();

  if (status === "loading") return <LoadingState />;
  if (loadError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ErrorState message={loadError} onRetry={retry} />
      </div>
    );
  }

  // The front door: visitors at / get the landing page; logged-in staff get their dashboard.
  if (!user && location.pathname === "/") return <Landing />;

  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="instructions/new" element={<NewInstruction />} />
        <Route path="instructions/:id" element={<InstructionDetail />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="translations" element={<Translations />} />
        <Route path="usage" element={<Usage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/** Everything behind staff login. Loaded lazily so the patient screen never downloads it. */
export default function StaffApp() {
  return (
    <AuthProvider>
      <StaffRoutes />
    </AuthProvider>
  );
}
