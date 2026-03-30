/**
 * Returns the auth token for API requests.
 * Priority: TaLockConfig.token > empty string
 * In development (VITE_DEV_MODE), a missing token logs a warning instead of blocking.
 */
export function getAuthToken(): string {
  return window.TaLockConfig?.token ?? "";
}

export function hasValidToken(): boolean {
  const token = getAuthToken();
  return token.length > 0;
}
