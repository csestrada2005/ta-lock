import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Development fallback: simulate LMS injecting config ──
if (!window.AskTetrConfig) {
  window.AskTetrConfig = {
    tenantId: "mock-tenant-1",
    courseId: "mock-course-123",
    studentId: "student-1",
    token: "",
  };
}

createRoot(document.getElementById("root")!).render(<App />);
