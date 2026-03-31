import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTaLock } from "@/contexts/TaLockContext";

/**
 * LTI 1.3 launch entry point.
 *
 * After lti-launch sets the HttpOnly talock_session cookie and redirects here,
 * this component calls /lti-session to retrieve non-sensitive claims, populates
 * the React context, then navigates to /chat.
 *
 * JavaScript never touches the raw session JWT — it lives only in the cookie.
 */
const LTILaunch = () => {
  const navigate = useNavigate();
  const { setLtiState } = useTaLock();

  useEffect(() => {
    const validateSession = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lti-session`,
          { credentials: "include" },
        );

        if (!response.ok) {
          navigate("/unauthorized", { replace: true });
          return;
        }

        const data = (await response.json()) as {
          tenantId: string;
          courseId: string;
          studentId: string;
          deploymentId?: string;
        };

        const config: TaLockConfig = {
          tenantId: data.tenantId ?? "",
          courseId: data.courseId ?? "",
          studentId: data.studentId ?? "",
        };

        // Expose non-sensitive fields for legacy consumers (no token)
        window.TaLockConfig = config;

        setLtiState(config);
        navigate("/chat", { replace: true });
      } catch {
        navigate("/unauthorized", { replace: true });
      }
    };

    validateSession();
  }, [navigate, setLtiState]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default LTILaunch;
