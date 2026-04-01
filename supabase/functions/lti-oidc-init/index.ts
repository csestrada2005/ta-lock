/**
 * lti-oidc-init — LTI 1.3 OIDC login initiation endpoint (Step 1 of 2)
 *
 * Canvas sends a GET or POST here before the actual launch.  This function:
 *   1. Validates the iss against the lti_platforms table
 *   2. Generates a cryptographically random nonce + state
 *   3. Stores the nonce in lti_nonces with a 10-minute TTL
 *   4. Redirects to the platform's OIDC auth_endpoint with the required params
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // ── 1. Parse parameters from GET query string or POST form body ─────────
    let params: URLSearchParams;

    if (req.method === "GET") {
      params = new URL(req.url).searchParams;
    } else {
      const body = await req.text();
      params = new URLSearchParams(body);
    }

    const iss = params.get("iss");
    const loginHint = params.get("login_hint");
    const targetLinkUri = params.get("target_link_uri");
    // NOTE: deployment_id is NOT available at OIDC init time — it arrives in
    // the id_token during the launch step, not in the login_hint parameters.
    // Canvas does encode deployment context inside lti_message_hint (an opaque
    // platform-specific blob forwarded verbatim to the auth endpoint).
    // TODO: parse Canvas-specific lti_message_hint to extract deployment_id for
    // multi-deployment disambiguation in a future iteration.
    const ltiMessageHint = params.get("lti_message_hint"); // optional
    const clientIdParam = params.get("client_id");         // optional

    if (!iss || !loginHint || !targetLinkUri) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: iss, login_hint, target_link_uri",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── 2. Look up the registered platform ─────────────────────────────────
    const { data: platform, error: platformErr } = await supabase
      .from("lti_platforms")
      .select("*")
      .eq("iss", iss)
      .single();

    if (platformErr || !platform) {
      return new Response(JSON.stringify({ error: "Unknown issuer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Generate nonce and state ─────────────────────────────────────────
    const nonce = crypto.randomUUID();
    const state = crypto.randomUUID();

    // ── 4. Store nonce and state with 10-minute TTL ─────────────────────────
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertErr } = await supabase
      .from("lti_nonces")
      .insert([
        { nonce: `nonce:${nonce}`, expires_at: expiresAt },
        { nonce: `state:${state}:nonce:${nonce}`, expires_at: expiresAt }
      ]);

    if (insertErr) {
      console.error("Failed to store nonce/state:", insertErr);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 5. Build the OIDC auth redirect URL ─────────────────────────────────
    const ltiLaunchUrl = Deno.env.get("LTI_LAUNCH_URL") ?? "";
    const effectiveClientId =
      clientIdParam ?? (platform.client_id as string);

    const authUrl = new URL(platform.auth_endpoint as string);
    authUrl.searchParams.set("scope", "openid");
    authUrl.searchParams.set("response_type", "id_token");
    authUrl.searchParams.set("client_id", effectiveClientId);
    authUrl.searchParams.set("redirect_uri", ltiLaunchUrl);
    authUrl.searchParams.set("login_hint", loginHint);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("response_mode", "form_post");
    authUrl.searchParams.set("prompt", "none");
    if (ltiMessageHint) {
      authUrl.searchParams.set("lti_message_hint", ltiMessageHint);
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: authUrl.toString(),
      },
    });
  } catch (err) {
    console.error("lti-oidc-init error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
