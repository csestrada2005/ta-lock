import { ShieldAlert } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const REASON_MESSAGES: Record<string, string> = {
  missing_token: "No launch token was provided. Please relaunch the tool from your LMS.",
  token_expired: "Your launch session has expired. Please relaunch the tool from your LMS.",
  token_used: "This launch link has already been used. Please relaunch the tool from your LMS.",
  network_error: "Could not reach the authentication server. Please check your connection and try again.",
  not_deep_link: "This launch is not a valid Deep Linking request. Please contact your instructor.",
  session_expired: "Your session has expired. Close this tab and relaunch TaLock from your Canvas module to continue.",
};

const Unauthorized = () => {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("reason");

  const message = reason && REASON_MESSAGES[reason]
    ? REASON_MESSAGES[reason]
    : "You must launch this tool from your LMS.";

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 p-8 text-center max-w-sm">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-semibold text-foreground">Unauthorized Access</h1>
        <p className="text-sm text-muted-foreground">
          {message}
        </p>
        {reason && (
          <p className="text-xs text-muted-foreground/50 mt-4">
            Error code: {reason}
          </p>
        )}
      </div>
    </div>
  );
};

export default Unauthorized;
