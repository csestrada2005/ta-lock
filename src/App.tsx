import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TenantProvider } from "@/contexts/TenantContext";
import { ChatBubbleWidget } from "@/components/ChatBubbleWidget";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Full from "./pages/Full";
import ResetPassword from "./pages/ResetPassword";
import ProfessorAI from "./pages/ProfessorAI";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Standalone: fills viewport, no bubble toggle */
const ProfessorStandalone = () => (
  <div className="h-dvh w-full">
    <ChatBubbleWidget defaultOpen>
      <ProfessorAI />
    </ChatBubbleWidget>
  </div>
);

/** Embeddable: floating bubble in bottom-right corner */
const ProfessorEmbed = () => (
  <ChatBubbleWidget defaultOpen={false}>
    <ProfessorAI />
  </ChatBubbleWidget>
);

interface AppProps {
  tenantId?: string;
  styleRoot?: HTMLElement | null;
}

const App = ({ tenantId, styleRoot }: AppProps = {}) => (
  <QueryClientProvider client={queryClient}>
    <TenantProvider tenantId={tenantId} styleRoot={styleRoot}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/professor" element={<ProfessorStandalone />} />
          <Route path="/embed" element={<ProfessorEmbed />} />
          <Route path="/full" element={<Full />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </TenantProvider>
  </QueryClientProvider>
);

export default App;
