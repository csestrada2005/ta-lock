import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchTenantConfig } from "@/services/mockApi";

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
  // Identity
  tenantId: string;
  courseId: string;
  studentId: string;
  token: string;
  cohortId: string;
  term: string;
  locale: string;
  // Branding (resolved from LMS override > API config > defaults)
  brandName: string;
  logoUrl: string;
  theme: { primary: string; secondary: string };
  // Loading state
  ready: boolean;
  // Raw config reference
  lmsConfig: TaLockConfig | null;
}

const TaLockContext = createContext<TaLockContextValue | null>(null);

interface TaLockProviderProps {
  children: ReactNode;
  /** From web component attribute — overrides window.TaLockConfig.tenantId */
  tenantId?: string;
  /** Optional Shadow DOM container — CSS variables are injected here instead of document.documentElement */
  styleRoot?: HTMLElement | null;
}

export function TaLockProvider({ children, tenantId, styleRoot }: TaLockProviderProps) {
  // Read LMS config once at mount; it is set by the host page before the widget loads
  const lmsConfig: TaLockConfig | null =
    typeof window !== "undefined" && window.TaLockConfig
      ? window.TaLockConfig
      : null;

  // Priority: prop (web component attribute) > LMS config > fallback
  const effectiveTenantId = tenantId ?? lmsConfig?.tenantId ?? FALLBACK_TENANT_ID;

  const [apiTheme, setApiTheme] = useState<{ primary: string; secondary: string } | null>(null);
  const [apiLogoUrl, setApiLogoUrl] = useState<string | null>(null);
  const [apiBrandName, setApiBrandName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchTenantConfig(effectiveTenantId).then((cfg) => {
      setApiTheme(cfg.theme);
      setApiLogoUrl(cfg.logoUrl);
      setApiBrandName(cfg.brandName);
      setReady(true);
    });
  }, [effectiveTenantId]);

  // Branding resolution: LMS theme override > API config > hardcoded defaults
  const resolvedTheme = {
    primary: lmsConfig?.theme?.primary ?? apiTheme?.primary ?? FALLBACK_THEME.primary,
    secondary: lmsConfig?.theme?.secondary ?? apiTheme?.secondary ?? FALLBACK_THEME.secondary,
  };
  const resolvedLogoUrl = lmsConfig?.theme?.logoUrl ?? apiLogoUrl ?? FALLBACK_LOGO_URL;
  const resolvedBrandName = lmsConfig?.theme?.brandName ?? apiBrandName ?? FALLBACK_BRAND_NAME;

  // Inject theme CSS variables whenever theme or styleRoot changes
  useEffect(() => {
    const root = styleRoot ?? document.documentElement;
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
  }, [resolvedTheme.primary, resolvedTheme.secondary, styleRoot]);

  const value: TaLockContextValue = {
    tenantId: effectiveTenantId,
    courseId: lmsConfig?.courseId ?? "",
    studentId: lmsConfig?.studentId ?? "",
    token: lmsConfig?.token ?? "",
    cohortId: lmsConfig?.cohortId ?? "",
    term: lmsConfig?.term ?? "",
    locale: lmsConfig?.locale ?? "en-US",
    brandName: resolvedBrandName,
    logoUrl: resolvedLogoUrl,
    theme: resolvedTheme,
    ready,
    lmsConfig,
  };

  return <TaLockContext.Provider value={value}>{children}</TaLockContext.Provider>;
}

export function useTaLock(): TaLockContextValue {
  const ctx = useContext(TaLockContext);
  if (!ctx) throw new Error("useTaLock must be used within TaLockProvider");
  return ctx;
}

/** @deprecated Use `useTaLock()` instead. Will be removed in a future release. */
export function useTenant(): TaLockContextValue {
  if (import.meta.env.DEV) {
    console.warn("[TaLock] useTenant() is deprecated — please migrate to useTaLock().");
  }
  return useTaLock();
}
