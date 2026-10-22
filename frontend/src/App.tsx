import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { ErrorState, LoadingState } from "./components/StateViews";
import { AuthProvider, useAuth } from "./lib/auth";
import { NotFound } from "./pages/NotFound";
import { Dashboard } from "./pages/staff/Dashboard";
import { Login } from "./pages/staff/Login";

function AppRoutes() {
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
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
