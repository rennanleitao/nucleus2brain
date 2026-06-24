import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AIRouterConfigurationError, routeAICompletion } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const profiles = {
  sales: "Sales Copilot: foco em intenção de compra, objeções, stakeholders, urgência, orçamento e próximos passos comerciais.",
  csc: "CSC Copilot: foco em sucesso do cliente, adoção, riscos de churn, expansão, bloqueios operacionais e próximos passos de relacionamento.",
  rpa: "RPA Copilot: foco em processos, automações, exceções, integrações, dados necessários, ganhos de eficiência e riscos técnicos.",
  executive: "Executive Copilot: foco em decisões, riscos estratégicos, lacunas de informação, oportunidades, alinhamento e próximos passos executivos.",
} as const;

type Profile = keyof typeof profiles;

function emptyAnalysis() {
  return {
    executive_summary: "",
    decisions: [] as string[],
    risks: [] as string[],
    unanswered_questions: [] as string[],
    next_best_question: "",
    objections: [] as string[],
    buying_signals: [] as string[],
    next_steps: [] as string[],
  };
}

function normalizeAnalysis(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const base = emptyAnalysis();
  const pickArray = (key: keyof typeof base) => Array.isArray(source[key]) ? source[key] as string[] : [];
  return {
    executive_summary: typeof source.executive_summary === "string" ? source.executive_summary : "",
    decisions: pickArray("decisions"),
    risks: pickArray("risks"),
    unanswered_questions: pickArray("unanswered_questions"),
    next_best_question: typeof source.next_best_question === "string" ? source.next_best_question : "",
    objections: pickArray("objections"),
    buying_signals: pickArray("buying_signals"),
    next_steps: pickArray("next_steps"),
  };
}

async function parseAIResponse(response: Response) {
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    return normalizeAnalysis(JSON.parse(toolCall.function.arguments));
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return normalizeAnalysis(JSON.parse(jsonMatch[0]));
  }

  throw new Error("AI response did not include a valid meeting analysis");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    const latestSegment = typeof body.latest_segment === "string" ? body.latest_segment.trim() : "";
    const profile: Profile = body.profile in profiles ? body.profile : "executive";
    const previousAnalysis = body.previous_analysis ?? null;

    if (!transcript && !latestSegment) {
      return new Response(JSON.stringify({ error: "transcript or latest_segment is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { response, provider, model } = await routeAICompletion(
      req,
      {
        messages: [
          {
            role: "system",
            content: `Você é o Meeting Copilot do Nucleus, um assessor executivo em tempo real durante reuniões.

Perfil de análise ativo:
${profiles[profile]}

Missão:
- Identificar decisões, riscos, oportunidades, lacunas de informação e próximos passos.
- Ajudar o usuário a fazer a próxima melhor pergunta durante a reunião.
- Ser objetivo, pragmático e orientado a ação.
- Responder em português do Brasil.
- Não inventar fatos. Se algo não estiver explícito na transcrição, marque como lacuna/pergunta.
- Retorne apenas dados compatíveis com o schema da ferramenta analyze_meeting.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              profile,
              latest_segment: latestSegment,
              transcript,
              previous_analysis: previousAnalysis,
            }),
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_meeting",
              description: "Structured real-time meeting analysis for the Nucleus Meeting Copilot panel.",
              parameters: {
                type: "object",
                properties: {
                  executive_summary: { type: "string" },
                  decisions: { type: "array", items: { type: "string" } },
                  risks: { type: "array", items: { type: "string" } },
                  unanswered_questions: { type: "array", items: { type: "string" } },
                  next_best_question: { type: "string" },
                  objections: { type: "array", items: { type: "string" } },
                  buying_signals: { type: "array", items: { type: "string" } },
                  next_steps: { type: "array", items: { type: "string" } },
                },
                required: [
                  "executive_summary",
                  "decisions",
                  "risks",
                  "unanswered_questions",
                  "next_best_question",
                  "objections",
                  "buying_signals",
                  "next_steps",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_meeting" } },
        max_tokens: 1800,
      },
      { defaultModel: "google/gemini-3-flash-preview" },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de IA atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error(`${provider} meeting-copilot error:`, response.status, text);
      throw new Error("AI gateway error");
    }

    const analysis = await parseAIResponse(response);
    return new Response(JSON.stringify({ analysis, provider, model }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("meeting-copilot error:", error);
    const isConfig = error instanceof AIRouterConfigurationError;
    return new Response(JSON.stringify({
      error: isConfig
        ? `API key não configurada para ${error.provider}.`
        : error instanceof Error ? error.message : "Unknown error",
    }), {
      status: isConfig ? 400 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
