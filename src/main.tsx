import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// TODO: PRODUCTION — remove this dev fallback; the host LMS must set window.TaLockConfig before the widget loads
// ── Development fallback: simulate LMS injecting config ──
if (!window.TaLockConfig) {
  window.TaLockConfig = {
    tenantId: "mock-tenant-1",
    courseId: "mock-course-123",
    studentId: "student-dev-1",
    token: "dev-token",
    cohortId: "2029",
    term: "term1",
    locale: "en-US",
    theme: {
      primary: "#800000",
      secondary: "#F1B82D",
      logoUrl: "",
      brandName: "TaLock Dev",
    },
  };
}

createRoot(document.getElementById("root")!).render(<App />);
