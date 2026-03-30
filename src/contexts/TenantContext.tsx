import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchTenantConfig, resolveDisplayName, type TenantConfig, type Course } from "@/services/mockApi";
import type { COURSES_BY_BATCH_TERM } from "@/data/courses";

interface TenantContextValue {
  /** Full personas map (includes modes + cohort data) */
  personas: Record<string, any>;
  /** Modes configuration (Study, Quiz, etc.) */
  modes: Record<string, { system_prompt: string; initial_message: string }>;
  /** Course catalogue keyed by batch → term */
  coursesByBatchTerm: typeof COURSES_BY_BATCH_TERM;
  /** Helper: resolve a class_id to its human-readable display name */
  getDisplayName: (classId: string) => string;
  /** Helper: get courses for a given batch + term */
  getCourses: (batch: string, term: string) => Course[];
  /** Helper: get persona config for a batch + classId */
  getPersona: (batch: string, classId: string) => Record<string, any> | undefined;
  /** Whether the config has finished loading */
  ready: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

const DEFAULT_TENANT_ID = "tetr";

export function TenantProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<TenantConfig | null>(null);

  useEffect(() => {
    fetchTenantConfig(DEFAULT_TENANT_ID).then(setConfig);
  }, []);

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
    ready: config !== null,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
