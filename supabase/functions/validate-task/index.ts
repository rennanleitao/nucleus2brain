import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a task clarity evaluator. Analyze ONLY the task title text provided. 
A task is "clear" if it alone declares effectively WHAT will be done — it should be specific and actionable.
A task is "vague" if it's too generic, broad, or doesn't specify a concrete deliverable or action.

Examples of VAGUE tasks: "Study", "Work on project", "Organize things", "Research", "Fix stuff", "Planning", "Review"
Examples of CLEAR tasks: "Write introduction for marketing report", "Fix login button bug on mobile", "Send proposal to client X", "Buy groceries for dinner"

If the task is vague, suggest 3-5 specific subtasks that would break it down into actionable pieces.

Respond with JSON using this tool.`,
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
                  reason: { type: "string", description: "Brief explanation in the user's language (match the task language)" },
                  suggested_subtasks: {
                    type: "array",
                    items: { type: "string" },
                    description: "If vague, 3-5 specific subtask suggestions in the same language as the task",
                  },
                },
                required: ["is_clear", "reason"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "evaluate_task" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
