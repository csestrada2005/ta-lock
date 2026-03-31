/**
 * lti-session — session validator called by the frontend after LTI launch
 *
 * The browser sends the talock_session HttpOnly cookie automatically.
 * This function verifies the HS256 JWT and returns the non-sensitive claims
 * that the frontend React context needs.  The raw JWT is never exposed.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  // Required for cookie-based cross-origin auth
  "Access-Control-Allow-Credentials": "true",
};

// ---------------------------------------------------------------------------
// Crypto helpers (Web Crypto only)
// ---------------------------------------------------------------------------

/** Decode a base64url string to Uint8Array. */
function base64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Verify an HS256 JWT and return the decoded payload, or null if invalid.
 */
async function verifyHS256(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlToBytes(signatureB64),
    encoder.encode(`${headerB64}.${payloadB64}`),
  );

  if (!valid) return null;

  try {
    return JSON.parse(
      new TextDecoder().decode(base64urlToBytes(payloadB64)),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 1. Extract talock_session cookie ────────────────────────────────────
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)talock_session=([^;]+)/);
  const sessionToken = match?.[1];

  if (!sessionToken) {
    return new Response(JSON.stringify({ error: "No valid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 2. Verify the JWT ────────────────────────────────────────────────────
  const secret = Deno.env.get("TALOCK_JWT_SECRET") ?? "";
  const payload = await verifyHS256(sessionToken, secret);

  if (!payload) {
    return new Response(JSON.stringify({ error: "No valid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 3. Check expiry ──────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && now > payload.exp) {
    return new Response(JSON.stringify({ error: "No valid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 4. Return non-sensitive claims only — never the raw JWT ─────────────
  return new Response(
    JSON.stringify({
      tenantId: payload.tenantId,
      courseId: payload.courseId,
      studentId: payload.studentId,
      deploymentId: payload.deploymentId,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
