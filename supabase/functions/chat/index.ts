import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROVIDER_URLS: Record<string, string> = {
  lovable: "https://ai.gateway.lovable.dev/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  mistral: "https://api.mistral.ai/v1/chat/completions",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();

    // Get user's AI settings
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let provider = "lovable";
    let model = "google/gemini-3-flash-preview";

    // Extract user from JWT to get their settings
    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: settings } = await supabase
          .from("ai_settings")
          .select("provider, model")
          .eq("user_id", user.id)
          .maybeSingle();
        if (settings) {
          provider = settings.provider || "lovable";
          model = settings.model || "google/gemini-3-flash-preview";
        }
      }
    }

    const systemPrompt = `You are Nucleus AI, a personal executive assistant. You help users manage their productivity.

You have access to the user's context:
${context ? JSON.stringify(context) : "No context provided yet."}

You can suggest actions by responding with structured JSON blocks wrapped in \`\`\`action markers. Available actions:
- create_task: {"action":"create_task","title":"...","priority":"low|medium|high","due_date":"YYYY-MM-DD","description":"..."}
- complete_task: {"action":"complete_task","task_id":"..."}
- create_calendar_event: {"action":"create_calendar_event","summary":"Meeting title","date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM","description":"Optional description","location":"Optional location"}

When the user asks you to schedule a meeting, event, or appointment, use create_calendar_event. Use the date and time from the user's request. If they don't specify an end time, default to 1 hour after the start time. If they say "tomorrow", "next Monday", etc., calculate the actual date based on today's date from the context.

When the user asks you to create tasks, schedule things, or manage their work, respond conversationally AND include the action block.

For questions about priorities, summaries, or advice, just respond conversationally using markdown.

Always be concise, actionable, and helpful. Speak in the same language the user uses.`;

    // Route to the correct provider
    if (provider === "lovable") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

      const response = await fetch(PROVIDER_URLS.lovable, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em instantes." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        throw new Error("AI gateway error");
      }

      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // For external providers, get API key from user_api_keys
    const { data: keyData } = await supabase
      .from("user_api_keys")
      .select("api_key")
      .eq("provider", provider)
      .maybeSingle();

    if (!keyData?.api_key) {
      return new Response(JSON.stringify({ error: `API key não configurada para ${provider}. Configure em Settings.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = keyData.api_key;

    if (provider === "anthropic") {
      // Anthropic has a different API format
      const response = await fetch(PROVIDER_URLS.anthropic, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("Anthropic error:", response.status, t);
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      // Transform Anthropic SSE to OpenAI-compatible SSE
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      (async () => {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, idx).trim();
              buffer = buffer.slice(idx + 1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6);
              if (json === "[DONE]") break;
              try {
                const parsed = JSON.parse(json);
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  const chunk = {
                    choices: [{ delta: { content: parsed.delta.text } }],
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              } catch {}
            }
          }
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          console.error("Transform error:", e);
        } finally {
          writer.close();
        }
      })();

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // OpenAI / Mistral (compatible APIs)
    const response = await fetch(PROVIDER_URLS[provider], {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error(`${provider} error:`, response.status, t);
      throw new Error(`${provider} API error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
