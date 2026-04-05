/**
 * lti-session — session validator and launch-token exchange endpoint
 *
 * POST /lti-session/exchange
 *   Exchanges a single-use launch token (minted by lti-launch) for a session
 *   token.  The frontend calls this once on /launch, stores the returned
 *   sessionToken in sessionStorage, then uses it as a Bearer token on all
 *   subsequent requests.
 *
 * GET /lti-session
 *   Re-hydrates claims from the session token sent in the Authorization: Bearer
 *   header.  Called on provider mount to restore state after a page refresh.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

  const secret = Deno.env.get("TALOCK_JWT_SECRET") ?? "";
  const url = new URL(req.url);

  // ── POST /lti-session/exchange ────────────────────────────────────────────
  if (req.method === "POST" && url.pathname.endsWith("/exchange")) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let launchToken: string | undefined;
    try {
      const body = await req.json() as Record<string, unknown>;
      launchToken = body.launchToken as string | undefined;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!launchToken) {
      return new Response(JSON.stringify({ error: "Missing launchToken" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify launch token signature
    const ltPayload = await verifyHS256(launchToken, secret);
    if (!ltPayload) {
      return new Response(JSON.stringify({ error: "Invalid launch token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check launch token expiry
    const now = Math.floor(Date.now() / 1000);
    if (typeof ltPayload.exp === "number" && now > ltPayload.exp) {
      return new Response(JSON.stringify({ error: "token_expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce single-use via jti stored in lti_nonces
    const jti = ltPayload.jti as string | undefined;
    if (!jti) {
      return new Response(JSON.stringify({ error: "Invalid launch token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: storedJti } = await supabase
      .from("lti_nonces")
      .select("nonce")
      .eq("nonce", `jti:${jti}`)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!storedJti) {
      return new Response(JSON.stringify({ error: "Token already used" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Consume the jti
    await supabase.from("lti_nonces").delete().eq("nonce", `jti:${jti}`);

    // Verify the inner session JWT
    const sessionJwt = ltPayload.sessionJwt as string | undefined;
    if (!sessionJwt) {
      return new Response(JSON.stringify({ error: "Invalid launch token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sessionPayload = await verifyHS256(sessionJwt, secret) as Record<string, unknown> & { platformIss?: string; tenantId?: string; courseId?: string; studentId?: string; deploymentId?: string; userRole?: string; roles?: string[]; isDeepLink?: boolean; agsLineitem?: string; agsScopes?: string[] };
    if (!sessionPayload) {
      return new Response(JSON.stringify({ error: "Invalid session token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof sessionPayload.exp === "number" && now > sessionPayload.exp) {
      return new Response(JSON.stringify({ error: "token_expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        sessionToken: sessionJwt,
        claims: {
          tenantId: sessionPayload.tenantId,
          courseId: sessionPayload.courseId,
          studentId: sessionPayload.studentId,
          deploymentId: sessionPayload.deploymentId,
          userRole: sessionPayload.userRole,
          roles: sessionPayload.roles,
          isDeepLink: sessionPayload.isDeepLink,
          agsLineitem: sessionPayload.agsLineitem ?? null,
          agsScopes: (sessionPayload.agsScopes as string[] | undefined) ?? null,
          platformIss: (sessionPayload.platformIss as string | undefined) ?? null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ── GET /lti-session ──────────────────────────────────────────────────────
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 1. Extract session token from Authorization: Bearer header ────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const sessionToken = match?.[1];

  if (!sessionToken) {
    return new Response(JSON.stringify({ error: "No valid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 2. Verify the JWT ─────────────────────────────────────────────────────
  const payload = await verifyHS256(sessionToken, secret) as Record<string, unknown> & { platformIss?: string; tenantId?: string; courseId?: string; studentId?: string; deploymentId?: string; userRole?: string; roles?: string[]; isDeepLink?: boolean; agsLineitem?: string; agsScopes?: string[] };

  if (!payload) {
    return new Response(JSON.stringify({ error: "No valid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 3. Check expiry ───────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && now > payload.exp) {
    return new Response(JSON.stringify({ error: "No valid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 4. Return non-sensitive claims only — never the raw JWT ───────────────
  return new Response(
    JSON.stringify({
      tenantId: payload.tenantId,
      courseId: payload.courseId,
      studentId: payload.studentId,
      deploymentId: payload.deploymentId,
      userRole: payload.userRole,
      roles: payload.roles,
      isDeepLink: (payload.isDeepLink as boolean | undefined) ?? false,
      agsLineitem: payload.agsLineitem ?? null,
      agsScopes: (payload.agsScopes as string[] | undefined) ?? null,
      platformIss: (payload.platformIss as string | undefined) ?? null,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
