import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTaLock } from "@/contexts/TaLockContext";

/**
 * LTI 1.3 launch entry point.
 *
 * lti-launch redirects here with a short-lived launch token in the `lt` query
 * parameter.  This component exchanges that token for a session token via
 * POST /lti-session/exchange, stores the session token in sessionStorage, then
 * navigates to /chat.  The `lt` param is immediately cleared from the URL so
 * it cannot be bookmarked or leaked via the Referer header.
 */
const LTILaunch = () => {
  const navigate = useNavigate();
  const { setLtiState } = useTaLock();

  useEffect(() => {
    const exchange = async () => {
      const lt = new URLSearchParams(window.location.search).get("lt");

      if (!lt) {
        navigate("/unauthorized?reason=missing_token", { replace: true });
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lti-session/exchange`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ launchToken: lt }),
          },
        );

        if (!response.ok) {
          let reason = "network_error";
          try {
            const err = (await response.json()) as { error?: string };
            if (err.error === "token_expired") reason = "token_expired";
            else if (err.error === "Token already used") reason = "token_used";
          } catch {
            // ignore parse errors
          }
          navigate(`/unauthorized?reason=${reason}`, { replace: true });
          return;
        }

        const data = (await response.json()) as {
          sessionToken: string;
          claims: {
            tenantId: string;
            courseId: string;
            studentId: string;
            deploymentId?: string;
          };
        };

        // Persist the session token for subsequent API calls
        sessionStorage.setItem("talock_session", data.sessionToken);

        // Remove the launch token from the URL immediately
        window.history.replaceState({}, "", "/launch");

        const config: TaLockConfig = {
          tenantId: data.claims.tenantId ?? "",
          courseId: data.claims.courseId ?? "",
          studentId: data.claims.studentId ?? "",
        };

        setLtiState(config);
        navigate("/chat", { replace: true });
      } catch {
        navigate("/unauthorized?reason=network_error", { replace: true });
      }
    };

    exchange();
  }, [navigate, setLtiState]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default LTILaunch;
