import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
    encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "talock-1" })),
  );
  const payloadB64 = bytesToBase64url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Strip PEM header/footer and decode base64
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

  if (sessionPayload.isDeepLink !== true || !sessionPayload.deepLinkReturnUrl) {
    return new Response(JSON.stringify({ error: "Not a deep link session" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json() as { selectedConfig?: { primaryColor?: string, secondaryColor?: string, logoUrl?: string, brandName?: string } };
    const { selectedConfig } = body;

    const privateKeyPem = Deno.env.get("TALOCK_PRIVATE_KEY") ?? "";
    if (!privateKeyPem) {
        console.error("TALOCK_PRIVATE_KEY is not set");
        return new Response(JSON.stringify({ error: "Server configuration error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const clientId = Deno.env.get("LTI_CLIENT_ID") ?? "";
    const platformIss = "https://canvas.instructure.com"; // Simplified: in reality, fetch platform from db based on deployment ID

    const jwtPayload = {
      iss: clientId,
      aud: platformIss, // The LMS issuer
      iat: now,
      exp: now + 600,
      nonce: crypto.randomUUID(),
      "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiDeepLinkingResponse",
      "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
      "https://purl.imsglobal.org/spec/lti/claim/deployment_id": sessionPayload.deploymentId,
      "https://purl.imsglobal.org/spec/lti-dl/claim/content_items": [
        {
          type: "ltiResourceLink",
          title: selectedConfig?.brandName || "TaLock Chat",
          custom: {
              primaryColor: selectedConfig?.primaryColor,
              secondaryColor: selectedConfig?.secondaryColor,
              logoUrl: selectedConfig?.logoUrl,
              brandName: selectedConfig?.brandName
          }
        }
      ]
    };

    const signedJwt = await signRS256(jwtPayload, privateKeyPem);

    return new Response(JSON.stringify({ jwt: signedJwt, returnUrl: sessionPayload.deepLinkReturnUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("lti-deep-link-response error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
