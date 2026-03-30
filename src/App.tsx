import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaLockProvider } from "@/contexts/TaLockContext";
import { ChatBubbleWidget } from "@/components/ChatBubbleWidget";
import { TokenGuard } from "@/components/TokenGuard";
import ProfessorAI from "./pages/ProfessorAI";

const queryClient = new QueryClient();

interface AppProps {
  tenantId?: string;
  styleRoot?: HTMLElement | null;
  /** When true, renders as a floating bubble widget; otherwise fills parent */
  embed?: boolean;
}

const App = ({ tenantId, styleRoot, embed = false }: AppProps = {}) => (
  <QueryClientProvider client={queryClient}>
    <TaLockProvider tenantId={tenantId} styleRoot={styleRoot}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <TokenGuard>
          <ChatBubbleWidget defaultOpen={!embed}>
            <ProfessorAI />
          </ChatBubbleWidget>
        </TokenGuard>
      </TooltipProvider>
    </TaLockProvider>
  </QueryClientProvider>
);

export default App;
