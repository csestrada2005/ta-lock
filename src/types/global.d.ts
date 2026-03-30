/** Global configuration injected by the host LMS before the widget loads. */
interface AskTetrConfig {
  tenantId: string;
  courseId: string;
  studentId: string;
  token?: string;
}

interface Window {
  AskTetrConfig?: AskTetrConfig;
}
