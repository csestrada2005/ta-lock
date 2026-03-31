import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTaLock } from "@/contexts/TaLockContext";

/**
 * LTI 1.3 launch entry point.
 *
 * After lti-launch generates a short-lived launch token and redirects here
 * with the `lt` query parameter, this component POSTs it to /lti-session/exchange
 * to exchange it for a session token, populates the React context, then navigates
 * to /chat.
 */
const LTILaunch = () => {
  const navigate = useNavigate();
  const { setLtiState } = useTaLock();

  useEffect(() => {
    const exchangeToken = async () => {
      const params = new URLSearchParams(window.location.search);
      const launchToken = params.get("lt");

      if (!launchToken) {
        navigate("/unauthorized?reason=missing_token", { replace: true });
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lti-session/exchange`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ launchToken }),
          },
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          const reason = errData?.error === "Token already used" ? "token_used" :
                         errData?.error === "Launch token expired" ? "token_expired" :
                         "invalid_token";
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

        // Store session token
        sessionStorage.setItem("talock_session", data.sessionToken);

        // Clear 'lt' param from URL
        window.history.replaceState({}, "", "/launch");

        const config: TaLockConfig = {
          tenantId: data.claims.tenantId ?? "",
          courseId: data.claims.courseId ?? "",
          studentId: data.claims.studentId ?? "",
        };

        // Expose non-sensitive fields for legacy consumers (no token)
        window.TaLockConfig = config;

        setLtiState(config);
        navigate("/chat", { replace: true });
      } catch {
        navigate("/unauthorized?reason=network_error", { replace: true });
      }
    };

    exchangeToken();
  }, [navigate, setLtiState]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default LTILaunch;
