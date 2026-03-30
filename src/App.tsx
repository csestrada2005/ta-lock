import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaLockProvider } from "@/contexts/TaLockContext";
import { TokenGuard } from "@/components/TokenGuard";
import ProfessorAI from "./pages/ProfessorAI";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TaLockProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <TokenGuard>
          <div className="h-screen w-screen">
            <ProfessorAI />
          </div>
        </TokenGuard>
      </TooltipProvider>
    </TaLockProvider>
  </QueryClientProvider>
);

export default App;
