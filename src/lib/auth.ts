/**
 * Cookie-based auth helpers.
 *
 * The talock_session JWT lives in an HttpOnly cookie — JavaScript cannot read
 * it.  All API calls must use apiFetch() so the browser includes the cookie
 * automatically via credentials: "include".
 */
export const AUTH_MODE = "cookie" as const;

/**
 * Wrapper around fetch() that always sends credentials (cookies).
 * Use this for every call to Supabase Edge Functions.
 */
export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...options, credentials: "include" });
}
