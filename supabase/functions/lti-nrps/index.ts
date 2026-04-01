import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  if (req.method !== "GET") {
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

  const deploymentId = sessionPayload.deploymentId as string | undefined;
  const courseId = sessionPayload.courseId as string | undefined;

  if (!deploymentId || !courseId) {
    return new Response(JSON.stringify({ error: "Missing deploymentId or courseId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: platform, error: platformErr } = await supabase
      .from("lti_platforms")
      .select("client_id, access_token_url, nrps_context_memberships_url")
      .eq("deployment_id", deploymentId)
      .single();

    if (platformErr || !platform) {
      return new Response(JSON.stringify({ error: "Platform not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!platform.nrps_context_memberships_url) {
      return new Response(JSON.stringify({ error: "NRPS not configured for this platform" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!platform.access_token_url) {
      return new Response(JSON.stringify({ error: "Access token URL not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const privateKeyPem = Deno.env.get("TALOCK_PRIVATE_KEY") ?? "";
    if (!privateKeyPem) {
      console.error("TALOCK_PRIVATE_KEY is not set");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = platform.client_id;
    const accessTokenUrl = platform.access_token_url;

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60;
    const jti = crypto.randomUUID();

    const clientAssertionPayload = {
      iss: clientId,
      sub: clientId,
      aud: accessTokenUrl,
      iat,
      exp,
      jti
    };

    const clientAssertion = await signRS256(clientAssertionPayload, privateKeyPem);

    const tokenParams = new URLSearchParams();
    tokenParams.append("grant_type", "client_credentials");
    tokenParams.append("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
    tokenParams.append("client_assertion", clientAssertion);
    tokenParams.append("scope", "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly");

    const tokenRes = await fetch(accessTokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: tokenParams
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Failed to fetch access token:", errText);
      return new Response(JSON.stringify({ error: "Failed to obtain platform access token" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const nrpsRes = await fetch(platform.nrps_context_memberships_url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/vnd.ims.lti-nrps.v2.membershipcontainer+json"
      }
    });

    if (!nrpsRes.ok) {
      const errText = await nrpsRes.text();
      console.error("Failed to fetch NRPS memberships:", errText);
      return new Response(JSON.stringify({ error: "Failed to fetch memberships from platform" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const membershipData = await nrpsRes.json();

    return new Response(JSON.stringify({ members: membershipData.members || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("lti-nrps error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
