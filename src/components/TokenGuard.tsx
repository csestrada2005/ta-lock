import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { hasValidToken } from "@/lib/auth";

interface TokenGuardProps {
  children: ReactNode;
}

/**
 * Blocks rendering until a valid TaLock token is present on window.TaLockConfig.
 * Polls once after 500 ms to allow late config injection, then shows an error if
 * the token is still missing.
 */
export const TokenGuard = ({ children }: TokenGuardProps) => {
  const [checked, setChecked] = useState(false);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    if (hasValidToken()) {
      setValid(true);
      setChecked(true);
      return;
    }

    // Allow host page to inject TaLockConfig asynchronously before declaring failure
    const timer = setTimeout(() => {
      setValid(hasValidToken());
      setChecked(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  if (!checked) return null;

  if (!valid) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 p-8 text-center max-w-xs">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Access configuration missing. Please reload this page or contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
