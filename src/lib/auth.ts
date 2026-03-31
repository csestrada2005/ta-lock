/**
 * Header-based auth helpers.
 *
 * The talock_session JWT lives in sessionStorage.
 * All API calls must use apiFetch() to attach the Authorization: Bearer token.
 */
export const AUTH_MODE = "header" as const;

/**
 * Wrapper around fetch() that attaches the session token.
 * Use this for every call to Supabase Edge Functions.
 */
export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = sessionStorage.getItem("talock_session");
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
}
