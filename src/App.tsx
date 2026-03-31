import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { TaLockProvider } from "@/contexts/TaLockContext";
import { useTaLock } from "@/contexts/TaLockContext";
import { Loader2 } from "lucide-react";
import LTILaunch from "@/pages/LTILaunch";
import ProfessorAI from "@/pages/ProfessorAI";
import Unauthorized from "@/pages/Unauthorized";

const queryClient = new QueryClient();

/** Guard: handles loading / authenticated / unauthenticated tri-state */
const RequireLTI = ({ children }: { children: React.ReactNode }) => {
  const { authStatus } = useTaLock();
  if (authStatus === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (authStatus === "unauthenticated") return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TaLockProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/launch" element={<LTILaunch />} />
            <Route
              path="/chat"
              element={
                <RequireLTI>
                  <ProfessorAI />
                </RequireLTI>
              }
            />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="*" element={<Navigate to="/unauthorized" replace />} />
          </Routes>
        </TooltipProvider>
      </TaLockProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
