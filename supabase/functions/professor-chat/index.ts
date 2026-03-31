import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const PROFESSOR_API_URL = "https://professor-agent-platform.onrender.com";

// CORS: allow origin from env variable (set in Supabase secrets), fallback to wildcard for dev
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cohort-id",
  "Access-Control-Allow-Credentials": "true",
};

// ---------------------------------------------------------------------------
// Header-based JWT validation (HS256, Web Crypto)
// ---------------------------------------------------------------------------

function base64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function verifySessionToken(
  authHeader: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];
  if (!token) return null;

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
    const payload = JSON.parse(
      new TextDecoder().decode(base64urlToBytes(payloadB64)),
    ) as Record<string, unknown>;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && now > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RENDER_API_KEY");
    if (!apiKey) {
      throw new Error("API key not configured");
    }

    // Verify caller via Authorization: Bearer token (LTI users are not
    // Supabase auth users, so supabaseClient.auth.getUser() cannot be used)
    const jwtSecret = Deno.env.get("TALOCK_JWT_SECRET") ?? "";
    const authHeader = req.headers.get("authorization") ?? "";
    const sessionPayload = await verifySessionToken(authHeader, jwtSecret);
    if (!sessionPayload) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");
    const mode = url.searchParams.get("mode");

    // Get cohort from header (default to 2029)
    const cohortId = req.headers.get("x-cohort-id") || "2029";

    // File upload proxy endpoint — avoids exposing RENDER API key to the browser
    if (endpoint === "upload") {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file) {
        return new Response(JSON.stringify({ error: "No file provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const forwardFormData = new FormData();
      forwardFormData.append("file", file);

      const response = await fetch(`${PROFESSOR_API_URL}/api/upload`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: forwardFormData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Upload backend error ${response.status}`);
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Analytics: cohort endpoint
    if (endpoint === "analytics-cohort") {
      const cohortParam = url.searchParams.get("cohort_id") || cohortId;
      const response = await fetch(`${PROFESSOR_API_URL}/analytics/cohort/${encodeURIComponent(cohortParam)}`, {
        headers: { "x-api-key": apiKey, "Accept": "application/json" },
      });
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Analytics: student endpoint
    if (endpoint === "analytics-student") {
      const studentId = url.searchParams.get("user_id");
      if (!studentId) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const response = await fetch(`${PROFESSOR_API_URL}/analytics/student/${encodeURIComponent(studentId)}`, {
        headers: { "x-api-key": apiKey, "Accept": "application/json" },
      });
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guardrails: GET
    if (endpoint === "guardrails-get") {
      const courseKey = url.searchParams.get("course_key");
      const cohortParam = url.searchParams.get("cohort_id") || cohortId;
      if (!courseKey) {
        return new Response(JSON.stringify({ error: "course_key required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const response = await fetch(
        `${PROFESSOR_API_URL}/guardrails/${encodeURIComponent(courseKey)}?cohort_id=${encodeURIComponent(cohortParam)}`,
        { headers: { "x-api-key": apiKey, "Accept": "application/json" } }
      );
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guardrails: SET (POST — body forwarded from client)
    if (endpoint === "guardrails-set") {
      const body = await req.json();
      const response = await fetch(`${PROFESSOR_API_URL}/guardrails/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Socratic: update
    if (endpoint === "socratic-update") {
      const body = await req.json();
      const response = await fetch(`${PROFESSOR_API_URL}/socratic/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch lectures endpoint
    if (endpoint === "lectures") {
      console.log(`Fetching lectures for cohort: ${cohortId}, mode: ${mode}`);

      const fetchLectures = async (cohortHeaderValue: string) => {
        const lectureUrl = mode
          ? `${PROFESSOR_API_URL}/api/lectures?mode=${encodeURIComponent(mode)}`
          : `${PROFESSOR_API_URL}/api/lectures`;

        const res = await fetch(lectureUrl, {
          headers: {
            "x-api-key": apiKey,
            "x-cohort-id": cohortHeaderValue,
            "Accept": "application/json",
          },
        });

        const text = await res.text();
        console.log(`Lectures response: status=${res.status} cohort=${cohortHeaderValue}`);

        let json: unknown = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch (e) {
          console.error("Failed to parse lectures JSON:", e);
        }

        return { res, json, rawText: text };
      };

      // First attempt
      let { res, json } = await fetchLectures(cohortId);

      // Retry logic for cohort prefix
      const lectures = ((json as Record<string, unknown>)?.lectures ?? []) as unknown[];
      if (res.ok && Array.isArray(lectures) && lectures.length === 0 && !cohortId.startsWith("cohort_")) {
        console.log(`Empty lectures for cohort ${cohortId}; retrying with cohort_${cohortId}`);
        const retry = await fetchLectures(`cohort_${cohortId}`);
        res = retry.res;
        json = retry.json;
      }

      if (!res.ok) {
        console.error("Failed to fetch lectures:", res.status);
        throw new Error(`Backend returned ${res.status}`);
      }

      return new Response(JSON.stringify((json as Record<string, unknown>) ?? { lectures: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chat endpoint - POST requests
    const body = await req.json() as Record<string, unknown>;
    console.log(`Chat request: endpoint=${body.endpoint ?? "chat"}, mode=${body.mode ?? "unknown"}`);

    // Handle submit-diagnostic endpoint
    if (body.endpoint === "submit-diagnostic") {
      const diagnosticResults = body.diagnostic_results as Record<string, unknown> | undefined;
      const diagnosticPayload = {
        session_id: body.session_id || null,
        cohort_id: body.cohort_id || cohortId,
        topic_slug: diagnosticResults?.topic_slug,
        answers: diagnosticResults?.answers,
        user_id: body.user_id || null,
      };

      console.log(`Sending diagnostic submission: session=${diagnosticPayload.session_id}`);

      const response = await fetch(`${PROFESSOR_API_URL}/api/diagnostic/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "x-cohort-id": cohortId,
        },
        body: JSON.stringify(diagnosticPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Diagnostic submit error:", response.status);
        throw new Error(`Backend returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build system message with formatting instructions
    const systemInstructions = `When providing Excel formulas, ALWAYS wrap them in Markdown code blocks (e.g., \`=SUM(A1:B1)\`).

When providing Mathematical equations, ALWAYS use LaTeX wrapped in double dollar signs (e.g., $$x = \\frac{-b}{2a}$$).

Use clear bullet points and bold text for lists of definitions.`;

    // Prepend system message if not already present
    const messages = (body.messages as unknown[]) || [];
    const hasSystemMessage = messages.length > 0 && (messages[0] as Record<string, unknown>).role === "system";
    const finalMessages = hasSystemMessage
      ? [
          { ...(messages[0] as Record<string, unknown>), content: `${systemInstructions}\n\n${(messages[0] as Record<string, unknown>).content}` },
          ...messages.slice(1),
        ]
      : [{ role: "system", content: systemInstructions }, ...messages];

    // Build payload with mode
    const payload = {
      messages: finalMessages,
      mode: body.mode || "Study",
      selectedCourse: body.selectedCourse || null,
      selectedLecture: body.selectedLecture === "__all__" ? null : (body.selectedLecture || null),
      cohort_id: body.cohort_id || cohortId,
      session_id: body.session_id || null,
      expertise_level: body.expertise_level || null,
      user_id: body.user_id || null,
      file_context: body.file_context || null,
    };

    console.log(`Forwarding chat: course=${payload.selectedCourse}, mode=${payload.mode}`);

    const response = await fetch(`${PROFESSOR_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "x-cohort-id": cohortId,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error:", response.status);
      throw new Error(`Backend returned ${response.status}: ${errorText}`);
    }

    // Handle Streaming Response
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("text/event-stream")) {
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Handle JSON Response
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Professor chat error:", error instanceof Error ? error.message : error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
