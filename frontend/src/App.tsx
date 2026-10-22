import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { LoadingState } from "./components/StateViews";
import { PatientInstruction } from "./pages/patient/PatientInstruction";

// The patient screen loads on its own (phones, slow data); staff code is a separate chunk.
const StaffApp = lazy(() => import("./StaffApp"));

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/p/:token" element={<PatientInstruction />} />
        <Route
          path="/*"
          element={
            <Suspense fallback={<LoadingState />}>
              <StaffApp />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
