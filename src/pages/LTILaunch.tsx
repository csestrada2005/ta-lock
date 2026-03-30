import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { useTaLock } from "@/contexts/TaLockContext";

/**
 * Decodes a base64url-encoded JWT payload (no verification — that happens server-side).
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/**
 * LTI 1.3 launch entry point.
 *
 * Reads `?token=<JWT>` from the URL, decodes the payload to extract
 * tenantId, courseId, studentId (and optional cohortId / term / theme),
 * writes them into window.TaLockConfig so TaLockProvider picks them up,
 * then navigates to /chat.
 */
const LTILaunch = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setLtiState } = useTaLock();

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) return;

    const payload = decodeJwtPayload(token);
    if (!payload) return;

    const ltiState: TaLockConfig = {
      tenantId: (payload.tenantId as string) ?? "",
      courseId: (payload.courseId as string) ?? "",
      studentId: (payload.studentId as string) ?? (payload.sub as string) ?? "",
      token,
      cohortId: (payload.cohortId as string) ?? undefined,
      term: (payload.term as string) ?? undefined,
      locale: (payload.locale as string) ?? undefined,
      theme: payload.theme as TaLockConfig["theme"] ?? undefined,
    };

    // Persist for other consumers (auth helpers, edge function calls)
    window.TaLockConfig = ltiState;

    // Push into React context
    setLtiState(ltiState);

    navigate("/chat", { replace: true });
  }, [token, navigate, setLtiState]);

  if (!token) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 p-8 text-center max-w-xs">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h1 className="text-lg font-semibold text-foreground">Unauthorized</h1>
          <p className="text-sm text-muted-foreground">
            No LTI launch token was provided. Please access this application through your LMS.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default LTILaunch;
