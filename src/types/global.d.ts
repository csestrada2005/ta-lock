/** Global configuration injected by the host LMS before the widget loads. */
interface TaLockConfig {
  tenantId: string;
  courseId: string;
  studentId: string;
  token: string;          // Short-lived JWT signed by TaLock secret
  cohortId?: string;      // Optional: LMS cohort/batch identifier
  term?: string;          // Optional: academic term identifier
  locale?: string;        // Optional: BCP-47 locale string e.g. "en-US"
  theme?: {
    primary?: string;     // Hex color e.g. "#800000"
    secondary?: string;   // Hex color e.g. "#F1B82D"
    logoUrl?: string;     // Absolute URL to tenant logo image
    brandName?: string;   // Display name e.g. "University AI Tutor"
  };
}

interface Window {
  TaLockConfig?: TaLockConfig;
}
