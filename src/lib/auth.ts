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
export function getAuthToken(): string | null {
  return sessionStorage.getItem("talock_session");
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    sessionStorage.removeItem("talock_session");
    if (window.location.pathname !== "/unauthorized") {
      window.location.href = "/unauthorized?reason=session_expired";
    }
    throw new Error("Session expired");
  }

  return response;
}
