import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { ToastProvider } from "./components/Toaster";
import { LoadingState } from "./components/StateViews";
import { ThemeProvider } from "./lib/theme";
import { PatientInstruction } from "./pages/patient/PatientInstruction";

// Data router so links and navigations can use native View Transitions.
// The patient screen loads on its own (phones, slow data); staff code is a separate, lazy chunk
// that keeps its own nested <Routes>.
const router = createBrowserRouter([
  {
    hydrateFallbackElement: <LoadingState />,
    children: [
      { path: "/p/:token", Component: PatientInstruction },
      {
        path: "*",
        lazy: async () => ({ Component: (await import("./StaffApp")).default }),
      },
    ],
  },
]);

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ThemeProvider>
  );
}
