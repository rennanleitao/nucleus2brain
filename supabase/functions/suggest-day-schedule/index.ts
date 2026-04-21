// Suggests a chronological order/time for the day's tasks using Lovable AI.
// Considers: existing Google Calendar events for the day, task priority, estimated_minutes,
// and an optional working window.
import { corsHeaders } from "@supabase/supabase-js/cors";

interface TaskInput {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  estimated_minutes?: number | null;
  scheduled_time?: string | null;
}

interface BusyEvent {
  summary?: string;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

interface RequestBody {
  date: string;            // YYYY-MM-DD
  tasks: TaskInput[];
  busy: BusyEvent[];       // Google events for the day
  workStart?: string;      // "HH:MM" default 09:00
  workEnd?: string;        // "HH:MM" default 18:00
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.date || !Array.isArray(body.tasks)) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const workStart = body.workStart || "09:00";
    const workEnd = body.workEnd || "18:00";

    const sysPrompt = `Você é um assistente de produtividade que organiza o dia do usuário.
Receberá: a data, uma lista de tasks (com prioridade e tempo estimado), eventos já marcados (busy), e a janela de trabalho.
Sua tarefa: sugerir um horário (HH:MM) para CADA task, encaixando-as nos espaços livres entre os eventos, dentro da janela de trabalho.

Regras importantes:
- NUNCA sobrepor com eventos busy.
- Tasks com prioridade "high" vêm primeiro / em horários de pico.
- Respeitar o tempo estimado (estimated_minutes). Se não houver, assumir 30min.
- Deixar buffer de 5-10min entre tasks quando possível.
- Se uma task não couber no dia, marcá-la com time=null e justificar em "reason".
- Responder SOMENTE via tool call.`;

    const userPrompt = JSON.stringify({
      date: body.date,
      workWindow: { start: workStart, end: workEnd },
      busy: body.busy,
      tasks: body.tasks,
    }, null, 2);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "schedule_tasks",
              description: "Return the suggested schedule for the day's tasks.",
              parameters: {
                type: "object",
                properties: {
                  schedule: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        task_id: { type: "string" },
                        time: { type: ["string", "null"], description: "HH:MM 24h or null if not scheduled" },
                        reason: { type: "string", description: "Short reason (max 80 chars)" },
                      },
                      required: ["task_id", "time", "reason"],
                      additionalProperties: false,
                    },
                  },
                  summary: { type: "string", description: "1-2 sentence overview of the plan" },
                },
                required: ["schedule", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "schedule_tasks" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro na IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiResp.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não retornou sugestão" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("suggest-day-schedule error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
