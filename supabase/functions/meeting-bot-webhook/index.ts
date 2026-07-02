import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeAICompletion } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

const profiles = {
  sales: "Cliente/Vendas: foco em clientes, oportunidades, objeções, stakeholders e follow-ups comerciais.",
  csc: "Relacionamento: foco em acompanhamento, satisfação, expectativas, riscos, bloqueios e próximos passos.",
  rpa: "Processos: foco em operações, automações, exceções, integrações, dados necessários e melhorias.",
  executive: "Geral: foco em resumo objetivo, decisões, tarefas, temas, pessoas citadas e perguntas abertas.",
} as const;

type Profile = keyof typeof profiles;

function normalizeAnalysis(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const pickArray = (key: string) => Array.isArray(source[key]) ? source[key] as string[] : [];
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

async function verifyRecallSignature(req: Request, payload: string) {
  const secret = Deno.env.get("RECALL_WEBHOOK_SECRET");
  if (!secret) return true;

  const msgId = req.headers.get("webhook-id") ?? req.headers.get("svix-id");
  const msgTimestamp = req.headers.get("webhook-timestamp") ?? req.headers.get("svix-timestamp");
  const msgSignature = req.headers.get("webhook-signature") ?? req.headers.get("svix-signature");
  if (!msgId || !msgTimestamp || !msgSignature) return false;

  const keyBase64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = Uint8Array.from(atob(keyBase64), (char) => char.charCodeAt(0));
  const data = new TextEncoder().encode(`${msgId}.${msgTimestamp}.${payload}`);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
  const expected = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return msgSignature
    .split(" ")
    .flatMap((part) => part.split(","))
    .some((part) => part.trim() === `v1,${expected}` || part.trim() === expected);
}

function getNestedString(source: unknown, path: string[]): string | null {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : null;
}

function extractTranscript(payload: Record<string, unknown>) {
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};
  const nested = data.data && typeof data.data === "object" ? data.data as Record<string, unknown> : {};
  const words = Array.isArray(nested.words) ? nested.words as Array<Record<string, unknown>> : [];
  const content = words
    .map((word) => typeof word.text === "string" ? word.text : "")
    .filter(Boolean)
    .join(" ")
    .trim();
  const participant = nested.participant && typeof nested.participant === "object"
    ? nested.participant as Record<string, unknown>
    : {};
  const start = words[0]?.start_timestamp;
  const relativeStart = start && typeof start === "object"
    ? (start as Record<string, unknown>).relative
    : null;

  return {
    content,
    speakerName: typeof participant.name === "string" ? participant.name : null,
    relativeStartSeconds: typeof relativeStart === "number" ? relativeStart : null,
    sessionId:
      getNestedString(data, ["realtime_endpoint", "metadata", "nucleus_session_id"]) ??
      getNestedString(data, ["bot", "metadata", "nucleus_session_id"]) ??
      getNestedString(payload, ["data", "bot", "metadata", "nucleus_session_id"]),
    botId:
      getNestedString(data, ["bot", "id"]) ??
      getNestedString(payload, ["data", "bot", "id"]),
  };
}

async function analyze(req: Request, profile: Profile, transcript: string, latestSegment: string, previousAnalysis: unknown) {
  const { response } = await routeAICompletion(
    req,
    {
      messages: [
        {
          role: "system",
          content: `Você é o organizador do módulo Reuniões do Nucleus.

Perfil de análise ativo:
${profiles[profile]}

Atualize a nota organizada com base no novo trecho transcrito da video-call.
Gere resumo, temas, tópicos, decisões, tarefas, perguntas abertas, pessoas citadas e tags.
Não invente fatos. Extraia tarefas apenas quando houver ação clara. Responda em português do Brasil.`,
        },
        {
          role: "user",
          content: JSON.stringify({ profile, latest_segment: latestSegment, transcript, previous_analysis: previousAnalysis }),
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
              required: ["summary", "theme_suggestion", "related_themes", "key_topics", "decisions", "action_items", "open_questions", "people", "tags", "confidence"],
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

  if (!response.ok) throw new Error(`AI gateway error: ${response.status}`);
  const data = await response.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return normalizeAnalysis(args ? JSON.parse(args) : {});
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const expectedToken = Deno.env.get("RECALL_WEBHOOK_TOKEN");
    if (expectedToken && url.searchParams.get("token") !== expectedToken) {
      return new Response(JSON.stringify({ error: "invalid webhook token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await req.text();
    if (!(await verifyRecallSignature(req, raw))) {
      return new Response(JSON.stringify({ error: "invalid webhook signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(raw || "{}") as Record<string, unknown>;
    if (payload.event !== "transcript.data") {
      return new Response(JSON.stringify({ ok: true, ignored: payload.event ?? "unknown" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { content, speakerName, relativeStartSeconds, sessionId, botId } = extractTranscript(payload);
    if (!content) {
      return new Response(JSON.stringify({ ok: true, ignored: "empty_transcript" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    let sessionQuery = db.from("meeting_copilot_sessions").select("*").limit(1);
    if (sessionId) sessionQuery = sessionQuery.eq("id", sessionId);
    else if (botId) sessionQuery = sessionQuery.eq("bot_id", botId);
    else throw new Error("Webhook did not include nucleus_session_id or bot id");

    const { data: sessions, error: sessionError } = await sessionQuery;
    if (sessionError) throw sessionError;
    const session = sessions?.[0];
    if (!session) throw new Error("Sessão de Reuniões não encontrada para o webhook da Recall");

    const displayContent = speakerName ? `${speakerName}: ${content}` : content;
    const transcript = [session.transcript, displayContent].filter(Boolean).join("\n\n");
    const profile: Profile = session.profile in profiles ? session.profile : "executive";

    let nextAnalysis = normalizeAnalysis(session.analysis);
    try {
      nextAnalysis = await analyze(req, profile, transcript, displayContent, session.analysis);
    } catch (error) {
      console.error("meeting-bot-webhook analysis error:", error);
    }

    await db.from("meeting_copilot_segments").insert({
      user_id: session.user_id,
      session_id: session.id,
      content,
      speaker_name: speakerName,
      relative_start_seconds: relativeStartSeconds,
      source: "recall",
      analysis_snapshot: nextAnalysis,
    });

    await db.from("meeting_copilot_sessions").update({
      transcript,
      analysis: nextAnalysis,
      bot_status: "transcribing",
      bot_error: null,
    }).eq("id", session.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("meeting-bot-webhook error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
