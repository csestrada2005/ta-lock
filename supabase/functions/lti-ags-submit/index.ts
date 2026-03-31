import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function base64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function bytesToBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

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

async function signRS256(
  payload: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  const encoder = new TextEncoder();

  const headerB64 = bytesToBase64url(
    encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
  );
  const payloadB64 = bytesToBase64url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const rawSig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(signingInput),
  );

  return `${signingInput}.${bytesToBase64url(new Uint8Array(rawSig))}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const sessionToken = match?.[1];

  if (!sessionToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const secret = Deno.env.get("TALOCK_JWT_SECRET") ?? "";
  const sessionPayload = await verifyHS256(sessionToken, secret);

  if (!sessionPayload) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof sessionPayload.exp === "number" && now > sessionPayload.exp) {
    return new Response(JSON.stringify({ error: "Token expired" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const agsLineitem = sessionPayload.agsLineitem as string | undefined;
  const agsScopes = sessionPayload.agsScopes as string[] | undefined;
  const studentId = sessionPayload.studentId as string;
  const tenantId = sessionPayload.tenantId as string;

  if (!agsLineitem || !agsScopes || !agsScopes.includes("https://purl.imsglobal.org/spec/lti-ags/scope/score")) {
    return new Response(JSON.stringify({ error: "AGS score scope not granted" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json() as { scoreType: 'quiz' | 'engagement', scoreValue: number, comment?: string };
    const { scoreType, scoreValue, comment } = body;

    const privateKeyPem = Deno.env.get("TALOCK_PRIVATE_KEY") ?? "";
    if (!privateKeyPem) {
      throw new Error("TALOCK_PRIVATE_KEY is not set");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get the platform details to find the token_endpoint
    // Note: We'd ideally find by iss/deploymentId, but for now we'll do a simple lookup by tenantId
    // If you had multiple deployments per tenant, this would need refinement.
    const { data: platform, error: platformErr } = await supabase
        .from("lti_platforms")
        .select("token_endpoint, client_id, iss")
        .eq("tenant_id", tenantId)
        .limit(1)
        .single();

    if (platformErr || !platform || !platform.token_endpoint) {
        throw new Error("Could not find platform token_endpoint for tenant");
    }

    const tokenEndpoint = platform.token_endpoint;
    const clientId = platform.client_id;

    // Build the client assertion JWT for OAuth 2.0 Client Credentials
    const assertionPayload = {
        iss: clientId,
        sub: clientId,
        aud: tokenEndpoint,
        iat: now,
        exp: now + 300,
        jti: crypto.randomUUID(),
    };

    const clientAssertion = await signRS256(assertionPayload, privateKeyPem);

    // Request access token from platform
    const tokenResponse = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            client_assertion: clientAssertion,
            scope: "https://purl.imsglobal.org/spec/lti-ags/scope/score",
        }),
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Failed to get AGS access token", tokenResponse.status, errorText);
        throw new Error("Failed to get AGS access token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Submit the score
    const scoreObject = {
        userId: studentId,
        scoreGiven: scoreValue,
        scoreMaximum: 1.0,
        comment: comment || `LTI AGS ${scoreType} submission`,
        timestamp: new Date().toISOString(),
        activityProgress: "Completed",
        gradingProgress: "FullyGraded"
    };

    const scoreResponse = await fetch(`${agsLineitem}/scores`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/vnd.ims.lis.v1.score+json",
        },
        body: JSON.stringify(scoreObject),
    });

    if (!scoreResponse.ok) {
        const errorText = await scoreResponse.text();
        console.error("Failed to submit score", scoreResponse.status, errorText);
        throw new Error("Failed to submit score to LMS");
    }

    return new Response(JSON.stringify({ submitted: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("lti-ags-submit error:", err);
    return new Response(JSON.stringify({ error: "AGS submission failed", detail: err.message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
