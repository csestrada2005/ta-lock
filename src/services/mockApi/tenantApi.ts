/**
 * Mock API service layer that simulates fetching tenant configuration,
 * courses, and personas from a backend. In a real implementation, these
 * would be HTTP calls to your config API.
 */

import coursesData from "@/data/courses";
import personasJson from "@/data/personas.json";

// Re-export the Course type so consumers don't need to import from data/
export type { Course } from "@/data/courses";

export interface PersonaConfig {
  display_name?: string;
  professor_name?: string;
  system_prompt?: string;
  initial_message?: string;
  [key: string]: unknown;
}

export interface ModeConfig {
  system_prompt: string;
  initial_message: string;
}

export interface TenantConfig {
  coursesByBatchTerm: typeof coursesData;
  personas: Record<string, any>;
  modes: Record<string, ModeConfig>;
}

// Simulated network delay (ms)
const SIMULATED_DELAY = 50;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Fetch the full tenant configuration (courses + personas + modes).
 * In production this would be: GET /api/tenants/{tenantId}/config
 */
export async function fetchTenantConfig(_tenantId: string): Promise<TenantConfig> {
  await delay(SIMULATED_DELAY);

  const allPersonas = personasJson as Record<string, any>;
  const modes = (allPersonas.modes ?? {}) as Record<string, ModeConfig>;

  return {
    coursesByBatchTerm: coursesData,
    personas: allPersonas,
    modes,
  };
}

/**
 * Resolve the display name for a class_id by searching across all batches.
 */
export function resolveDisplayName(
  personas: Record<string, any>,
  classId: string,
): string {
  for (const batchId of Object.keys(personas)) {
    if (batchId === "modes") continue;
    if (personas[batchId]?.[classId]) {
      return personas[batchId][classId].display_name || classId;
    }
  }
  return classId;
}
