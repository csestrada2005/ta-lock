import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TaLockProvider } from "@/contexts/TaLockContext";
import LTILaunch from "@/pages/LTILaunch";
import ProfessorAI from "@/pages/ProfessorAI";
import { useTaLock } from "@/contexts/TaLockContext";
import { ShieldAlert } from "lucide-react";

const queryClient = new QueryClient();

/** Guard: only render children if an LTI session is active */
const RequireLTI = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useTaLock();
  if (!isAuthenticated) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
};

const Unauthorized = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3 p-8 text-center max-w-xs">
      <ShieldAlert className="h-10 w-10 text-destructive" />
      <h1 className="text-lg font-semibold text-foreground">Unauthorized</h1>
      <p className="text-sm text-muted-foreground">
        Please access this application through your LMS.
      </p>
    </div>
  </div>
);

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
