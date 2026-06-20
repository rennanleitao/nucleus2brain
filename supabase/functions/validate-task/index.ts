import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { routeAICompletion } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title } = await req.json();
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { response } = await routeAICompletion(req, {
        messages: [
          {
            role: "system",
            content: `You are a task clarity evaluator. Analyze ONLY the task title text provided.
A task is "clear" if it alone declares effectively WHAT will be done — it should be specific and actionable.
A task is "vague" if it's too generic, broad, or doesn't specify a concrete deliverable or action.

Examples of VAGUE: "Study", "Work on project", "Organize things", "Research", "Fix stuff", "Planning"
Examples of CLEAR: "Write introduction for marketing report", "Fix login button bug on mobile", "Send proposal to client X"

If the task is vague:
1. Suggest a better, more specific title (suggested_title)
2. Suggest 3-5 subtasks that break it into actionable pieces

Always respond in the SAME LANGUAGE as the task title.`,
          },
          { role: "user", content: `Task title: "${title}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "evaluate_task",
              description: "Evaluate if a task title is clear and actionable",
              parameters: {
                type: "object",
                properties: {
                  is_clear: { type: "boolean", description: "true if the task is specific and actionable" },
                  reason: { type: "string", description: "Brief explanation in the user's language" },
                  suggested_title: { type: "string", description: "A better, more specific title suggestion. Only if vague." },
                  suggested_subtasks: {
                    type: "array",
                    items: { type: "string" },
                    description: "If vague, 3-5 specific subtask suggestions",
                  },
                },
                required: ["is_clear", "reason"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "evaluate_task" } },
    }, { defaultModel: "google/gemini-3-flash-preview" });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-task error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
