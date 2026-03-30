import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// No dev fallback — LTI token must be provided via /launch?token=...
createRoot(document.getElementById("root")!).render(<App />);
