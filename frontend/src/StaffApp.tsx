import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { ErrorState, LoadingState } from "./components/StateViews";
import { AuthProvider, useAuth } from "./lib/auth";
import { NotFound } from "./pages/NotFound";
import { Dashboard } from "./pages/staff/Dashboard";
import { InstructionDetail } from "./pages/staff/InstructionDetail";
import { Login } from "./pages/staff/Login";
import { NewInstruction } from "./pages/staff/NewInstruction";

function StaffRoutes() {
  const { status, loadError, retry } = useAuth();

  if (status === "loading") return <LoadingState />;
  if (loadError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ErrorState message={loadError} onRetry={retry} />
      </div>
    );
  }

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
