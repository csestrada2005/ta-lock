/**
 * Bearer-token auth helpers.
 *
 * The talock_session JWT is stored in sessionStorage after the lti-session
 * /exchange call completes.  All API calls attach it as an Authorization:
 * Bearer header via apiFetch().
 */
export const AUTH_MODE = "bearer" as const;

/**
 * Wrapper around fetch() that reads the session token from sessionStorage and
 * attaches it as an Authorization: Bearer header on every request.
 * If no token is present the request is still made; the server will 401.
 */
export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = sessionStorage.getItem("talock_session");
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}
