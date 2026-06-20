// Suggests a chronological order/time for the day's tasks using the configured AI provider.
// Considers: existing Google Calendar events for the day, task priority, estimated_minutes,
// optional working window, and per-task triage hints (type/urgency/complexity).
import { routeAICompletion } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskInput {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  estimated_minutes?: number | null;
  scheduled_time?: string | null;
  // Optional triage answers from the user (per task) — 3 simple questions.
  triage?: {
    urgency?: string;    // "Sim, hoje" | "Pode esperar" | "Tem deadline"
    autonomy?: string;   // "Só de mim" | "Depende de outros"
    complexity?: string; // "Simples" | "Complexa"
  };
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

    const workStart = body.workStart || "09:00";
    const workEnd = body.workEnd || "18:00";

    const sysPrompt = `Você é um assistente de produtividade que organiza o dia do usuário.
Receberá: a data, lista de tasks (com prioridade, tempo estimado e respostas de triagem opcionais), eventos já marcados (busy), e a janela de trabalho.
Sua tarefa: sugerir um horário (HH:MM) para CADA task, encaixando-as nos espaços livres entre os eventos, dentro da janela de trabalho.

Triagem (3 perguntas simples por task):
- triage.urgency: "Sim, hoje" (precisa concluir hoje), "Pode esperar", "Tem deadline" (urgência fixa).
- triage.autonomy: "Só de mim" (executa sozinho), "Depende de outros" (precisa de terceiros).
- triage.complexity: "Simples" (~20min) ou "Complexa" (~60min, exige foco).

Regras de priorização:
- "Sim, hoje" e "Tem deadline" entram primeiro / em horários de pico (manhã).
- "Depende de outros" → agendar mais cedo no dia, dando tempo para resposta/follow-up.
- "Complexa" → blocos longos pela manhã (energia alta). "Simples" → agrupar em blocos curtos pós-almoço ou fim do dia.
- NUNCA sobrepor com eventos busy.
- Respeitar estimated_minutes quando informado; senão usar 20min (simples) ou 60min (complexa) como fallback.
- Deixar buffer de 5-10min entre tasks quando possível.
- Se uma task não couber no dia, marcá-la com time=null e justificar em "reason".
- Responder SOMENTE via tool call.`;

    const userPrompt = JSON.stringify({
      date: body.date,
      workWindow: { start: workStart, end: workEnd },
      busy: body.busy,
      tasks: body.tasks,
    }, null, 2);

    const { response: aiResp, provider } = await routeAICompletion(req, {
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
                      duration_minutes: { type: "number", description: "Suggested duration in minutes (multiple of 5, min 5)" },
                      reason: { type: "string", description: "Short reason (max 80 chars)" },
                    },
                    required: ["task_id", "time", "duration_minutes", "reason"],
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
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error(`${provider} AI error:`, aiResp.status, t);
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
