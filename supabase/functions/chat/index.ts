import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AIRouterConfigurationError, routeAICompletion } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();

    const systemPrompt = `You are Helena, the AI assistant inside Nucleus. You help users manage their productivity.

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

    const { response, provider } = await routeAICompletion(req, {
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    }, {
      allowLegacyProviders: true,
      defaultModel: "google/gemini-3-flash-preview",
    });

    if (!response.ok) {
      if (provider === "lovable" && response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (provider === "lovable" && response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error(`${provider} error:`, response.status, t);
      throw new Error(`${provider} API error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        ...(provider === "lovable" ? {
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        } : {}),
      },
    });
  } catch (e) {
    console.error("chat error:", e);
    if (e instanceof AIRouterConfigurationError) {
      return new Response(JSON.stringify({ error: `API key não configurada para ${e.provider}. Configure em Settings.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
