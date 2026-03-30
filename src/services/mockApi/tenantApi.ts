export interface Course {
  id: string;      // db_key for backend
  name: string;    // display name
}

export interface ThemeColors {
  primary: string;   // hex e.g. '#800000'
  secondary: string; // hex e.g. '#F1B82D'
}

export interface TenantConfig {
  theme: ThemeColors;
  logoUrl: string;
  brandName: string;
}

// Simulated network delay (ms)
const SIMULATED_DELAY = 50;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * TODO: replace with real API call to GET /api/tenants/{tenantId}/config
 *
 * Returns branding config for the given tenant. The host LMS may also inject
 * theme overrides via window.TaLockConfig.theme, which take precedence over
 * the values returned here.
 */
export async function fetchTenantConfig(_tenantId: string): Promise<TenantConfig> {
  await delay(SIMULATED_DELAY);

  return {
    theme: {
      primary: "#800000",
      secondary: "#F1B82D",
    },
    logoUrl: "/ta-lock-logo.png",
    brandName: "TaLock",
  };
}
