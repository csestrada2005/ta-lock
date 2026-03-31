import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RagDocument {
  metadata?: { title?: string; class_name?: string };
  content?: string;
}

interface AiMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, selectedClass, persona, file_content, image_data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let courseContext = "";
    let sources: RagDocument[] = [];

    // Fetch relevant course materials
    if (messages.length > 0) {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage.role === "user") {
        try {
          const ragResponse = await fetch(`${SUPABASE_URL}/functions/v1/rag-search`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: lastUserMessage.content,
              selectedClass: selectedClass,
            }),
          });

          if (ragResponse.ok) {
            const ragData = await ragResponse.json();
            if (ragData.documents && ragData.documents.length > 0) {
              sources = ragData.documents;
              courseContext = "\n\nRelevant course materials:\n" +
                (ragData.documents as RagDocument[]).map((doc, idx) =>
                  `[${idx + 1}] ${doc.metadata?.title ?? 'Document'} (${doc.metadata?.class_name ?? ''})\n${doc.content ?? ''}`
                ).join("\n\n");
            }
          }
        } catch (e) {
          console.error("RAG search failed:", e);
        }
      }
    }

    // Build file context block if file_content is provided
    const fileContextBlock = file_content
      ? `\n\n=== USER UPLOADED DOCUMENT ===\n${file_content}\n==============================\n`
      : "";

    // Build system prompt based on class and persona
    const systemPrompt = `You are an AI tutor for ${selectedClass || "general studies"}. ${
      persona ? `Your teaching style: ${persona}` : ""
    }

CRITICAL INSTRUCTIONS:
- You MUST ONLY use information from the provided course materials below
- DO NOT use any external knowledge or information from your training
- If the course materials don't contain the answer, say "I don't have information about that in the course materials"
- When answering, ALWAYS reference the source material by number [1], [2], etc.
- Stay strictly within the scope of the course topic
${file_content ? "- When a user uploaded document is provided, use it as additional context to answer questions" : ""}

FORMATTING RULES (MANDATORY):
- NEVER use markdown bold formatting (**text**) - just write plain text
- Keep answers SHORT and DIGESTIBLE - students don't like long walls of text
- Use bullet points and short paragraphs (2-3 sentences max)
- Break complex ideas into simple, bite-sized pieces
- NEVER change the course name "${selectedClass}" - always use it exactly as provided

Your role:
- Answer questions using ONLY the course materials provided
- Keep responses concise and student-friendly
- Break down complex topics into easy chunks
- Help students learn efficiently without overwhelming them
${courseContext ? courseContext : "\n\nNo course materials were found for this query. Inform the student that you need course content to answer their question."}
${fileContextBlock}
Keep responses SHORT, clear, and conversational. Students prefer quick, actionable answers over long explanations.`;

    console.log("AI Tutor request:", { 
      selectedClass, 
      persona, 
      messageCount: messages.length, 
      sourcesFound: sources.length,
      hasFileContent: !!file_content,
      hasImageData: !!image_data 
    });

    // Build messages array with potential multimodal content
    const aiMessages: AiMessage[] = [{ role: "system", content: systemPrompt }];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      // If this is the last user message and we have image_data, make it multimodal
      if (i === messages.length - 1 && msg.role === "user" && image_data?.data && image_data?.media_type) {
        aiMessages.push({
          role: "user",
          content: [
            { type: "text", text: msg.content },
            {
              type: "image_url",
              image_url: {
                url: `data:${image_data.media_type};base64,${image_data.data}`
              }
            }
          ]
        });
      } else {
        aiMessages.push(msg);
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we have sources, prepend them to the stream
    if (sources.length > 0) {
      const encoder = new TextEncoder();
      const sourcesData = JSON.stringify({ sources });
      const sourcesEvent = `data: ${JSON.stringify({ 
        choices: [{ delta: { content: "", sources: sourcesData } }] 
      })}\n\n`;
      
      const combinedStream = new ReadableStream({
        async start(controller) {
          // Send sources first
          controller.enqueue(encoder.encode(sourcesEvent));
          
          // Then pipe the AI response
          const reader = response.body!.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        }
      });

      return new Response(combinedStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-tutor-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
