import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AIRouterConfigurationError, routeAICompletion } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const profiles = {
  sales: "Cliente/Vendas: foco em clientes, oportunidades, objeções, stakeholders e follow-ups comerciais.",
  csc: "Relacionamento: foco em acompanhamento, satisfação, expectativas, riscos, bloqueios e próximos passos.",
  rpa: "Processos: foco em operações, automações, exceções, integrações, dados necessários e melhorias.",
  executive: "Geral: foco em resumo objetivo, decisões, tarefas, temas, pessoas citadas e perguntas abertas.",
} as const;

type Profile = keyof typeof profiles;

function emptyAnalysis() {
  return {
    summary: "",
    theme_suggestion: "",
    related_themes: [] as string[],
    key_topics: [] as string[],
    decisions: [] as string[],
    action_items: [] as string[],
    open_questions: [] as string[],
    people: [] as string[],
    tags: [] as string[],
    confidence: 0,
  };
}

function normalizeAnalysis(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const base = emptyAnalysis();
  const pickArray = (key: keyof typeof base) => Array.isArray(source[key]) ? source[key] as string[] : [];
  return {
    summary: typeof source.summary === "string"
      ? source.summary
      : typeof source.executive_summary === "string" ? source.executive_summary : "",
    theme_suggestion: typeof source.theme_suggestion === "string" ? source.theme_suggestion : "",
    related_themes: pickArray("related_themes"),
    key_topics: pickArray("key_topics"),
    decisions: pickArray("decisions"),
    action_items: Array.isArray(source.action_items)
      ? source.action_items as string[]
      : Array.isArray(source.next_steps) ? source.next_steps as string[] : [],
    open_questions: Array.isArray(source.open_questions)
      ? source.open_questions as string[]
      : Array.isArray(source.unanswered_questions) ? source.unanswered_questions as string[] : [],
    people: pickArray("people"),
    tags: pickArray("tags"),
    confidence: typeof source.confidence === "number" ? source.confidence : 0,
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
    const theme = typeof body.theme === "string" ? body.theme.trim() : "";
    const captureType = typeof body.capture_type === "string" ? body.capture_type.trim() : "conversation";
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
            content: `Você é o organizador do módulo Reuniões do Nucleus.

Perfil de análise ativo:
${profiles[profile]}

Missão:
- Transformar gravações, conversas, reuniões e notas faladas em uma memória organizada.
- Gerar resumo curto, tópicos, decisões, tarefas, perguntas abertas, pessoas citadas, tags e temas.
- Sugerir um tema principal quando o usuário não informar um.
- Responder em português do Brasil.
- Não inventar fatos, decisões, pessoas ou tarefas.
- Extraia tarefas apenas quando houver uma ação clara.
- Separe fatos explícitos de dúvidas usando open_questions.
- Retorne apenas dados compatíveis com o schema da ferramenta organize_capture.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              profile,
              theme,
              capture_type: captureType,
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
              name: "organize_capture",
              description: "Structured conversation, meeting, and voice note organization for Nucleus Reuniões.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  theme_suggestion: { type: "string" },
                  related_themes: { type: "array", items: { type: "string" } },
                  key_topics: { type: "array", items: { type: "string" } },
                  decisions: { type: "array", items: { type: "string" } },
                  action_items: { type: "array", items: { type: "string" } },
                  open_questions: { type: "array", items: { type: "string" } },
                  people: { type: "array", items: { type: "string" } },
                  tags: { type: "array", items: { type: "string" } },
                  confidence: { type: "number" },
                },
                required: [
                  "summary",
                  "theme_suggestion",
                  "related_themes",
                  "key_topics",
                  "decisions",
                  "action_items",
                  "open_questions",
                  "people",
                  "tags",
                  "confidence",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "organize_capture" } },
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
