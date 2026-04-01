/**
 * lti-launch — LTI 1.3 OIDC authorization response handler
 *
 * Canvas (or any LTI 1.3 platform) POSTs an id_token here after the user
 * completes the OIDC login initiation flow.  This function:
 *   1. Validates the state parameter (CSRF protection) against lti_nonces
 *   2. Verifies the RS256-signed id_token against the platform's JWKS
 *   3. Validates exp, nbf, aud, and nonce uniqueness
 *   4. Extracts LTI 1.3 claims
 *   5. Mints a short-lived internal HS256 session JWT
 *   6. Mints a single-use launch token (5 min TTL) and redirects to /launch?lt=
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS — Canvas embeds the tool in an iframe so SameSite=None is required;
// the origin is typically the LMS domain.
// lti-launch receives form POSTs from the LMS, not credentialed fetches, so
// wildcard origin is acceptable but we prefer consistency with ALLOWED_ORIGIN.
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Crypto helpers (Web Crypto only — no external libraries)
// ---------------------------------------------------------------------------

/** Decode a base64url string to Uint8Array. */
function base64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Decode a base64url string to a UTF-8 string. */
function base64urlToString(str: string): string {
  return new TextDecoder().decode(base64urlToBytes(str));
}

/** Encode a Uint8Array to base64url (no padding). */
function bytesToBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Verify an RS256 JWT using the provided CryptoKey.
 * Returns true only when the signature is valid.
 */
async function verifyRS256(
  headerB64: string,
  payloadB64: string,
  signatureB64: string,
  publicKey: CryptoKey,
): Promise<boolean> {
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64urlToBytes(signatureB64);
  return crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    publicKey,
    signature,
    data,
  );
}

/** Import an RSA public key from a JWK object. */
async function importRsaPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

/**
 * Sign a payload as an HS256 JWT using the given secret string.
 * Returns the compact serialization `header.payload.signature`.
 */
async function signHS256(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();

  const headerB64 = bytesToBase64url(
    encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  );
  const payloadB64 = bytesToBase64url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const rawSig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signingInput),
  );

  return `${signingInput}.${bytesToBase64url(new Uint8Array(rawSig))}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate Content-Type
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return new Response(
      JSON.stringify({ error: "Expected application/x-www-form-urlencoded" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // ── 1. Extract id_token and state from POST body ─────────────────────────
    const body = await req.text();
    const params = new URLSearchParams(body);
    const idToken = params.get("id_token");
    const state = params.get("state");

    if (!idToken) {
      return new Response(JSON.stringify({ error: "Missing id_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Validate state parameter (CSRF protection) ────────────────────────
    if (!state) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing state parameter" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: storedState } = await supabase
      .from("lti_nonces")
      .select("nonce")
      .eq("nonce", `state:${state}`)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!storedState) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired state" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Consume the state to prevent reuse
    await supabase.from("lti_nonces").delete().eq("nonce", `state:${state}`);

    const parts = idToken.split(".");
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ error: "Malformed JWT" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // ── 3. Decode header and payload ─────────────────────────────────────────
    let jwtHeader: { alg?: string; kid?: string; typ?: string };
    let jwtPayload: Record<string, unknown>;
    try {
      jwtHeader = JSON.parse(base64urlToString(headerB64));
      jwtPayload = JSON.parse(base64urlToString(payloadB64));
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JWT encoding" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const kid = jwtHeader.kid;
    const iss = jwtPayload.iss as string | undefined;

    if (!iss) {
      return new Response(JSON.stringify({ error: "Missing iss claim" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deploymentId = jwtPayload["https://purl.imsglobal.org/spec/lti/claim/deployment_id"] as string | undefined;

    if (!deploymentId) {
      return new Response(JSON.stringify({ error: "Missing deployment_id claim" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Look up the registered platform ───────────────────────────────────
    const { data: platform, error: platformErr } = await supabase
      .from("lti_platforms")
      .select("*")
      .eq("iss", iss)
      .eq("deployment_id", deploymentId)
      .single();

    if (platformErr || !platform) {
      return new Response(JSON.stringify({ error: "Unknown deployment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 5. Fetch the platform's JWKS and find the matching key ───────────────
    const jwksRes = await fetch(platform.jwks_uri as string);
    if (!jwksRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch JWKS" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwks = (await jwksRes.json()) as {
      keys: Array<{ kid?: string; kty: string } & JsonWebKey>;
    };

    const jwk = kid
      ? jwks.keys.find((k) => k.kid === kid)
      : jwks.keys.find((k) => k.kty === "RSA");

    if (!jwk) {
      return new Response(JSON.stringify({ error: "No matching JWK found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 6. Verify the RS256 signature ─────────────────────────────────────────
    let publicKey: CryptoKey;
    try {
      publicKey = await importRsaPublicKey(jwk as JsonWebKey);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to import public key" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const sigOk = await verifyRS256(
      headerB64,
      payloadB64,
      signatureB64,
      publicKey,
    );
    if (!sigOk) {
      return new Response(
        JSON.stringify({ error: "JWT signature verification failed" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── 7. Standard JWT claims validation ────────────────────────────────────
    const now = Math.floor(Date.now() / 1000);

    const exp = jwtPayload.exp as number | undefined;
    if (exp !== undefined && now > exp) {
      return new Response(JSON.stringify({ error: "JWT has expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nbf = jwtPayload.nbf;
    if (nbf !== undefined && typeof nbf === "number" && now < nbf) {
      return new Response(JSON.stringify({ error: "JWT not yet valid (nbf)" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audience must contain our client_id
    const clientId =
      Deno.env.get("LTI_CLIENT_ID") ?? (platform.client_id as string);
    const aud = jwtPayload.aud as string | string[] | undefined;
    const audArray = Array.isArray(aud) ? aud : aud ? [aud] : [];
    if (!audArray.includes(clientId)) {
      return new Response(
        JSON.stringify({ error: "JWT audience mismatch" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── 8. Nonce uniqueness (anti-replay) ─────────────────────────────────────
    const nonce = jwtPayload.nonce as string | undefined;
    if (!nonce) {
      return new Response(JSON.stringify({ error: "Missing nonce claim" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The nonce must have been registered by lti-oidc-init and not yet used
    const { data: storedNonce } = await supabase
      .from("lti_nonces")
      .select("nonce")
      .eq("nonce", nonce)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!storedNonce) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired nonce" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Consume the nonce to prevent replay
    await supabase.from("lti_nonces").delete().eq("nonce", nonce);

    // ── 9. Extract LTI 1.3 claims ─────────────────────────────────────────────
    const contextClaim = jwtPayload[
      "https://purl.imsglobal.org/spec/lti/claim/context"
    ] as { id?: string } | undefined;

    const customClaim = jwtPayload[
      "https://purl.imsglobal.org/spec/lti/claim/custom"
    ] as { tenantId?: string; tenant_id?: string } | undefined;

    const courseId = contextClaim?.id ?? "";
    const studentId = (jwtPayload.sub as string | undefined) ?? "";
    const tenantId =
      customClaim?.tenantId ??
      customClaim?.tenant_id ??
      (platform.tenant_id as string) ??
      "";

    const messageType = jwtPayload["https://purl.imsglobal.org/spec/lti/claim/message_type"] as string | undefined;

    let isDeepLink = false;
    let deepLinkReturnUrl: string | undefined = undefined;

    if (messageType === "LtiDeepLinkingRequest") {
      const dlSettings = jwtPayload["https://purl.imsglobal.org/spec/lti/claim/deep_linking_settings"] as { deep_link_return_url?: string } | undefined;
      isDeepLink = true;
      deepLinkReturnUrl = dlSettings?.deep_link_return_url;
    }

    const agsClaim = jwtPayload["https://purl.imsglobal.org/spec/lti-ags/claim/endpoint"] as { lineitem?: string; scope?: string[] } | undefined;
    const agsLineitem = agsClaim?.lineitem;
    const agsScopes = agsClaim?.scope;

    // ── 10. Mint internal HS256 session JWT ───────────────────────────────────
    const jwtSecret = Deno.env.get("TALOCK_JWT_SECRET") ?? "";
    if (!jwtSecret) {
      console.error("TALOCK_JWT_SECRET is not set");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const iat = now;
    const sessionExp = now + 3600; // 1 hour

    const sessionJwt = await signHS256(
      {
        tenantId,
        courseId,
        studentId,
        deploymentId: deploymentId ?? "",
        isDeepLink,
        deepLinkReturnUrl,
        agsLineitem,
        agsScopes,
        iat,
        exp: sessionExp,
      },
      jwtSecret,
    );

    // ── 11. Mint single-use launch token (5 min TTL) ──────────────────────────
    // The launch token wraps the session JWT and is exchanged by the frontend
    // for the session token via POST /lti-session/exchange.  This avoids
    // HttpOnly cookies which are blocked in iframes by Safari/Chrome ITP.
    const jti = crypto.randomUUID();
    const launchTokenExp = now + 300; // 5 minutes

    const launchToken = await signHS256(
      { sessionJwt, jti, iat, exp: launchTokenExp },
      jwtSecret,
    );

    // Store the jti so the exchange endpoint can enforce single-use
    const launchTokenExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await supabase
      .from("lti_nonces")
      .insert({ nonce: `jti:${jti}`, expires_at: launchTokenExpiresAt });

    // ── 12. Redirect to frontend /launch?lt=<launchToken> ────────────────────
    const frontendUrl = Deno.env.get("FRONTEND_URL") ?? "";
    const redirectPath = isDeepLink ? "/deep-link" : "/launch";
    const redirectTarget = `${frontendUrl}${redirectPath}?lt=${encodeURIComponent(launchToken)}`;

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectTarget,
      },
    });
  } catch (err) {
    console.error("lti-launch error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
