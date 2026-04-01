/** Non-sensitive LTI session claims exposed to the frontend after cookie validation. */
interface TaLockConfig {
  tenantId: string;
  courseId: string;
  studentId: string;
  agsLineitem?: string | null;
  agsScopes?: string[] | null;
  deploymentId?: string;
  term?: string;          // Optional: academic term identifier
  locale?: string;        // Optional: BCP-47 locale string e.g. "en-US"
  theme?: {
    primary?: string;     // Hex color e.g. "#800000"
    secondary?: string;   // Hex color e.g. "#F1B82D"
    logoUrl?: string;     // Absolute URL to tenant logo image
    brandName?: string;   // Display name e.g. "University AI Tutor"
  };
}

