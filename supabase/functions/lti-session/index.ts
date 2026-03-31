/**
 * lti-session — session validator called by the frontend after LTI launch
 *
 * The browser sends the talock_session HttpOnly cookie automatically.
 * This function verifies the HS256 JWT and returns the non-sensitive claims
 * that the frontend React context needs.  The raw JWT is never exposed.
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

  const url = new URL(req.url);

  // ── POST /exchange ───────────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname.endsWith("/exchange")) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    try {
      const body = await req.json();
      const launchToken = body.launchToken;

      if (!launchToken) {
        return new Response(JSON.stringify({ error: "Missing launchToken" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const secret = Deno.env.get("TALOCK_JWT_SECRET") ?? "";
      const launchPayload = await verifyHS256(launchToken, secret);

      if (!launchPayload) {
        return new Response(JSON.stringify({ error: "Invalid launch token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = Math.floor(Date.now() / 1000);
      if (typeof launchPayload.exp === "number" && now > launchPayload.exp) {
        return new Response(JSON.stringify({ error: "Launch token expired" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const jti = launchPayload.jti as string | undefined;
      if (!jti) {
        return new Response(JSON.stringify({ error: "Invalid launch token payload" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check jti uniqueness (single use)
      const { data: storedNonce } = await supabase
        .from("lti_nonces")
        .select("nonce")
        .eq("nonce", jti)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (!storedNonce) {
        return new Response(JSON.stringify({ error: "Token already used" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Consume the jti
      await supabase.from("lti_nonces").delete().eq("nonce", jti);

      // Verify the inner sessionJwt
      const sessionJwt = launchPayload.sessionJwt as string | undefined;
      if (!sessionJwt) {
        return new Response(JSON.stringify({ error: "Missing sessionJwt" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sessionPayload = await verifyHS256(sessionJwt, secret);
      if (!sessionPayload) {
        return new Response(JSON.stringify({ error: "Invalid session token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof sessionPayload.exp === "number" && now > sessionPayload.exp) {
        return new Response(JSON.stringify({ error: "Session token expired" }), {
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
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (err) {
      console.error("/exchange error:", err);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── GET (validate active session token) ──────────────────────────────────
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Extract session token from Authorization: Bearer header
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const sessionToken = match?.[1];

  if (!sessionToken) {
    return new Response(JSON.stringify({ error: "No valid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const secret = Deno.env.get("TALOCK_JWT_SECRET") ?? "";
  const payload = await verifyHS256(sessionToken, secret);

  if (!payload) {
    return new Response(JSON.stringify({ error: "No valid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && now > payload.exp) {
    return new Response(JSON.stringify({ error: "No valid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
