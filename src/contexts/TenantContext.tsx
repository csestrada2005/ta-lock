import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchTenantConfig, resolveDisplayName, type TenantConfig, type Course, type ThemeColors } from "@/services/mockApi";
import type { COURSES_BY_BATCH_TERM } from "@/data/courses";

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

// ---------- context value ----------
interface TenantContextValue {
  personas: Record<string, any>;
  modes: Record<string, { system_prompt: string; initial_message: string }>;
  coursesByBatchTerm: typeof COURSES_BY_BATCH_TERM;
  getDisplayName: (classId: string) => string;
  getCourses: (batch: string, term: string) => Course[];
  getPersona: (batch: string, classId: string) => Record<string, any> | undefined;
  theme: ThemeColors;
  logoUrl: string;
  brandName: string;
  ready: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

const DEFAULT_TENANT_ID = "tetr";

// Default theme used while config is loading
const FALLBACK_THEME: ThemeColors = { primary: "#800000", secondary: "#F1B82D" };

interface TenantProviderProps {
  children: ReactNode;
  /** Tenant identifier — defaults to "tetr" */
  tenantId?: string;
  /** Optional Shadow DOM root to inject CSS variables into instead of document.documentElement */
  styleRoot?: HTMLElement | null;
}

export function TenantProvider({ children, tenantId, styleRoot }: TenantProviderProps) {
  const [config, setConfig] = useState<TenantConfig | null>(null);

  useEffect(() => {
    fetchTenantConfig(tenantId ?? DEFAULT_TENANT_ID).then(setConfig);
  }, [tenantId]);

  // Inject theme CSS variables into :root whenever theme changes
  useEffect(() => {
    const theme = config?.theme ?? FALLBACK_THEME;
    const root = document.documentElement;

    const primaryHsl = hexToHsl(theme.primary);
    const secondaryHsl = hexToHsl(theme.secondary);

    // Override the existing design-system variables so all components
    // using bg-primary, text-primary-foreground, etc. pick them up automatically
    root.style.setProperty("--primary", primaryHsl);
    root.style.setProperty("--accent", primaryHsl);
    root.style.setProperty("--ring", primaryHsl);

    // Derive a very light foreground for dark primary backgrounds
    root.style.setProperty("--primary-foreground", "0 0% 100%");
    root.style.setProperty("--accent-foreground", "0 0% 100%");

    // Secondary / chat-user-bg
    root.style.setProperty("--chat-user-bg", secondaryHsl);

    // Tenant-specific custom properties (for anything that needs them explicitly)
    root.style.setProperty("--theme-primary", primaryHsl);
    root.style.setProperty("--theme-secondary", secondaryHsl);

    // Gradient overrides
    root.style.setProperty(
      "--gradient-hero",
      `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${secondaryHsl}), hsl(${primaryHsl}))`,
    );
    root.style.setProperty(
      "--shadow-soft",
      `0 4px 20px -4px hsl(${primaryHsl} / 0.2)`,
    );
    root.style.setProperty(
      "--shadow-hover",
      `0 8px 30px -4px hsl(${primaryHsl} / 0.35)`,
    );
    root.style.setProperty(
      "--shadow-glow",
      `0 0 40px -10px hsl(${primaryHsl} / 0.4)`,
    );
  }, [config?.theme]);

  const value: TenantContextValue = {
    personas: config?.personas ?? {},
    modes: config?.modes ?? {},
    coursesByBatchTerm: config?.coursesByBatchTerm ?? ({} as typeof COURSES_BY_BATCH_TERM),
    getDisplayName: (classId: string) =>
      config ? resolveDisplayName(config.personas, classId) : classId,
    getCourses: (batch: string, term: string) =>
      config?.coursesByBatchTerm[batch]?.[term] ?? [],
    getPersona: (batch: string, classId: string) =>
      config?.personas[batch]?.[classId],
    theme: config?.theme ?? FALLBACK_THEME,
    logoUrl: config?.logoUrl ?? "/asktetr-logo.png",
    brandName: config?.brandName ?? "AskTETR",
    ready: config !== null,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
