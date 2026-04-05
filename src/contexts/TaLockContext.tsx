import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { apiFetch } from "@/lib/auth";

export interface TenantConfig {
  theme: { primary: string; secondary: string };
  logoUrl: string;
  brandName: string;
}

// ---------- hex → HSL helper ----------
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ---------- defaults ----------
const FALLBACK_THEME = { primary: "#800000", secondary: "#F1B82D" };
const FALLBACK_BRAND_NAME = "TaLock";
const FALLBACK_LOGO_URL = "/ta-lock-logo.png";
const FALLBACK_TENANT_ID = "talock";

// ---------- context value ----------
interface TaLockContextValue {
  tenantId: string;
  courseId: string;
  studentId: string;
  agsLineitem: string | null;
  agsScopes: string[] | null;
  deploymentId: string;
  userRole: "instructor" | "student";
  roles: string[];
  term: string;
  locale: string;
  brandName: string;
  logoUrl: string;
  theme: { primary: string; secondary: string };
  ready: boolean;
  lmsConfig: TaLockConfig | null;
  /** Auth status: loading while checking sessionStorage on mount */
  authStatus: "loading" | "authenticated" | "unauthenticated" | "error";
  networkErrorCode: number | null;
  /** True once the session has been validated */
  isAuthenticated: boolean;
  /** Called by LTILaunch after a successful /exchange */
  setLtiState: (config: TaLockConfig) => void;
  retryHydration: () => void;
  sessionExpiringSoon: boolean;
  dismissExpiryWarning: () => void;
}

const TaLockContext = createContext<TaLockContextValue | null>(null);

interface TaLockProviderProps {
  children: ReactNode;
}

export function TaLockProvider({ children }: TaLockProviderProps) {
  const [lmsConfig, setLmsConfig] = useState<TaLockConfig | null>(null);
  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "unauthenticated" | "error">("loading");
  const [networkErrorCode, setNetworkErrorCode] = useState<number | null>(null);
  const [sessionExpiringSoon, setSessionExpiringSoon] = useState(false);

  const effectiveTenantId = lmsConfig?.tenantId ?? FALLBACK_TENANT_ID;

  const [apiTheme, setApiTheme] = useState<{ primary: string; secondary: string } | null>(null);
  const [apiLogoUrl, setApiLogoUrl] = useState<string | null>(null);
  const [apiBrandName, setApiBrandName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const setLtiState = useCallback((config: TaLockConfig) => {
    setLmsConfig(config);
    setAuthStatus("authenticated");
  }, []);

  const hydrateSession = useCallback(() => {
    const token = sessionStorage.getItem("talock_session");

    if (!token) {
      setAuthStatus("unauthenticated");
      return;
    }

    // Re-hydrate claims from the server to populate context
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lti-session`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            sessionStorage.removeItem("talock_session");
            setAuthStatus("unauthenticated");
          } else {
            setAuthStatus("error");
            setNetworkErrorCode(res.status);
          }
          return;
        }
        const data = (await res.json()) as {
          tenantId: string;
          courseId: string;
          studentId: string;
          deploymentId?: string;
          userRole?: "instructor" | "student";
          roles?: string[];
          agsLineitem?: string | null;
          agsScopes?: string[] | null;
        };
        setLmsConfig({
          tenantId: data.tenantId ?? "",
          courseId: data.courseId ?? "",
          studentId: data.studentId ?? "",
          deploymentId: data.deploymentId ?? "",
          userRole: data.userRole ?? "student",
          roles: data.roles ?? [],
          agsLineitem: data.agsLineitem ?? null,
          agsScopes: data.agsScopes ?? null,
        });
        setAuthStatus("authenticated");
        setNetworkErrorCode(null);
      })
      .catch(() => {
        setAuthStatus("error");
        setNetworkErrorCode(null);
      });
  }, []);

  const retryHydration = useCallback(() => {
    setAuthStatus("loading");
    setNetworkErrorCode(null);
    hydrateSession();
  }, [hydrateSession]);

  // On mount: check sessionStorage for an existing session token and re-hydrate
  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  // Session expiry warning logic
  useEffect(() => {
    if (authStatus !== "authenticated") return;

    const token = sessionStorage.getItem("talock_session");
    if (!token) return;

    try {
      const parts = token.split(".");
      if (parts.length !== 3) return;

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const padLength = (4 - (base64.length % 4)) % 4;
      const paddedBase64 = base64 + "=".repeat(padLength);

      const binaryString = atob(paddedBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const decoder = new TextDecoder("utf-8");
      const decodedString = decoder.decode(bytes);
      const payload = JSON.parse(decodedString);

      if (typeof payload.exp === "number") {
        const msUntilWarning = (payload.exp - 15 * 60) * 1000 - Date.now();

        if (msUntilWarning <= 0) {
          setSessionExpiringSoon(true);
        } else {
          const timeoutId = setTimeout(() => {
            setSessionExpiringSoon(true);
          }, msUntilWarning);
          return () => clearTimeout(timeoutId);
        }
      }
    } catch (e) {
      console.error("Failed to parse token for expiry warning:", e);
    }
  }, [authStatus]);

  useEffect(() => {
    if (!effectiveTenantId || effectiveTenantId === FALLBACK_TENANT_ID) {
      setReady(true);
      return;
    }
    apiFetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tenant-config?tenantId=${effectiveTenantId}`
    )
      .then(async (res) => {
        if (!res.ok) return;
        const cfg = await res.json() as TenantConfig;
        setApiTheme(cfg.theme);
        setApiLogoUrl(cfg.logoUrl);
        setApiBrandName(cfg.brandName);
      })
      .catch((err) => {
        console.error("Failed to fetch tenant config:", err);
      })
      .finally(() => setReady(true));
  }, [effectiveTenantId]);

  const resolvedTheme = {
    primary: lmsConfig?.theme?.primary ?? apiTheme?.primary ?? FALLBACK_THEME.primary,
    secondary: lmsConfig?.theme?.secondary ?? apiTheme?.secondary ?? FALLBACK_THEME.secondary,
  };
  const resolvedLogoUrl = lmsConfig?.theme?.logoUrl ?? apiLogoUrl ?? FALLBACK_LOGO_URL;
  const resolvedBrandName = lmsConfig?.theme?.brandName ?? apiBrandName ?? FALLBACK_BRAND_NAME;

  useEffect(() => {
    const root = document.documentElement;
    const primaryHsl = hexToHsl(resolvedTheme.primary);
    const secondaryHsl = hexToHsl(resolvedTheme.secondary);

    root.style.setProperty("--primary", primaryHsl);
    root.style.setProperty("--accent", primaryHsl);
    root.style.setProperty("--ring", primaryHsl);
    root.style.setProperty("--primary-foreground", "0 0% 100%");
    root.style.setProperty("--accent-foreground", "0 0% 100%");
    root.style.setProperty("--chat-user-bg", secondaryHsl);
    root.style.setProperty("--theme-primary", primaryHsl);
    root.style.setProperty("--theme-secondary", secondaryHsl);
    root.style.setProperty(
      "--gradient-hero",
      `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${secondaryHsl}), hsl(${primaryHsl}))`,
    );
    root.style.setProperty("--shadow-soft", `0 4px 20px -4px hsl(${primaryHsl} / 0.2)`);
    root.style.setProperty("--shadow-hover", `0 8px 30px -4px hsl(${primaryHsl} / 0.35)`);
    root.style.setProperty("--shadow-glow", `0 0 40px -10px hsl(${primaryHsl} / 0.4)`);
  }, [resolvedTheme.primary, resolvedTheme.secondary]);

  const isAuthenticated = authStatus === "authenticated";

  const dismissExpiryWarning = useCallback(() => {
    setSessionExpiringSoon(false);
  }, []);

  const value: TaLockContextValue = {
    tenantId: effectiveTenantId,
    courseId: lmsConfig?.courseId ?? "",
    studentId: lmsConfig?.studentId ?? "",
    agsLineitem: lmsConfig?.agsLineitem ?? null,
    agsScopes: lmsConfig?.agsScopes ?? null,
    deploymentId: lmsConfig?.deploymentId ?? "",
    userRole: lmsConfig?.userRole ?? "student",
    roles: lmsConfig?.roles ?? [],
    term: lmsConfig?.term ?? "",
    locale: lmsConfig?.locale ?? "en-US",
    brandName: resolvedBrandName,
    logoUrl: resolvedLogoUrl,
    theme: resolvedTheme,
    ready,
    lmsConfig,
    authStatus,
    networkErrorCode,
    isAuthenticated,
    setLtiState,
    retryHydration,
    sessionExpiringSoon,
    dismissExpiryWarning,
  };

  return <TaLockContext.Provider value={value}>{children}</TaLockContext.Provider>;
}

export function useTaLock(): TaLockContextValue {
  const ctx = useContext(TaLockContext);
  if (!ctx) throw new Error("useTaLock must be used within TaLockProvider");
  return ctx;
}
