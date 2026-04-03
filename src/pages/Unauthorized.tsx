import { ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useTaLock } from "@/contexts/TaLockContext";

const REASON_MESSAGES: Record<string, string> = {
  missing_token: "Your session could not be established.",
  token_expired: "Your session has expired.",
  token_used: "This launch link has already been used.",
  network_error: "A network error occurred.",
  insufficient_role: "You do not have permission to access this page.",
  not_deep_link: "This page can only be accessed via a Deep Link launch.",
};

const Unauthorized = () => {
  const context = useTaLock();
  const logoUrl = context?.theme?.logoUrl || "/ta-lock-logo.png";

  const reason = new URLSearchParams(window.location.search).get("reason");

  const message = reason && REASON_MESSAGES[reason]
    ? REASON_MESSAGES[reason]
    : "An unexpected error occurred.";

  useEffect(() => {
    try {
      window.parent.postMessage({ subject: "lti.enableScrolling", value: true }, "*");

      window.parent.postMessage(
        { subject: "lti.frameResize", height: 0 },
        "*"
      );

      setTimeout(() => {
        window.parent.postMessage(
          { subject: "lti.showModuleNavigation", show: true },
          "*"
        );
      }, 1500);
    } catch {
      // ignore — postMessage may fail if not in an iframe
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="flex flex-col items-center gap-6 p-8 text-center max-w-md w-full">
        {logoUrl && (
          <img src={logoUrl} alt="Logo" className="h-16 w-16 object-contain mb-2" />
        )}
        <ShieldAlert className="h-12 w-12 text-destructive" />

        <h1 className="text-2xl font-bold text-foreground">Launch Error</h1>

        <div className="space-y-4">
          <p className="text-base text-foreground font-medium">
            {message}
          </p>

          <div className="bg-muted p-4 rounded-md">
            <p className="text-sm font-semibold text-foreground">
              To continue, please close this panel and reopen TaLock from your Canvas course page.
            </p>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            If this problem persists, contact your instructor or IT support.
          </p>

          {reason && (
            <p className="text-xs text-muted-foreground/30 mt-8">
              Error code: {reason}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Unauthorized;
