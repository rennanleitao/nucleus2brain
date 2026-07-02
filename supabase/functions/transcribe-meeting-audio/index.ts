import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TranscribeRequest = {
  audio_base64?: string;
  mime_type?: string;
};

function getAudioFormat(mimeType?: string): string {
  const normalized = (mimeType || "").toLowerCase();
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "mp4";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("webm")) return "webm";
  return "webm";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { audio_base64, mime_type }: TranscribeRequest = await req.json();
    const audioData = audio_base64?.replace(/^data:audio\/[^;]+;base64,/, "").trim();
    if (!audioData) {
      return new Response(JSON.stringify({ error: "Missing audio_base64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const transcribeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Você é um assistente que produz ATAS EXAUSTIVAS de reuniões presenciais em português do Brasil.",
                "NÃO resuma. NÃO condense. NÃO omita conteúdo relevante. O objetivo é capturar TUDO o que foi dito, com riqueza de detalhes, mas organizado de forma legível.",
                "",
                "Estruture a saída em Markdown, EXATAMENTE nesta ordem (omita uma seção somente se realmente não houver conteúdo para ela):",
                "",
                "## Contexto",
                "Breve enquadramento (1–3 linhas) sobre o tema da reunião, se inferível.",
                "",
                "## Participantes",
                "Lista de nomes/papéis mencionados (quando identificáveis).",
                "",
                "## Transcrição detalhada",
                "Transcrição COMPLETA e organizada por blocos temáticos com subtítulos (### Tópico). Dentro de cada bloco, use parágrafos e bullets para registrar TUDO o que foi discutido: argumentos, exemplos, números, datas, nomes de empresas/produtos/clientes, valores, prazos, contexto, dúvidas levantadas, respostas dadas. Preserve nuances e posições divergentes. Pode indicar falantes quando distinguíveis (ex: **Falante A:**). Limpe apenas vícios de linguagem, repetições involuntárias e hesitações ('éé', 'tipo assim'), SEM cortar conteúdo.",
                "",
                "## Principais pontos",
                "Bullets com os pontos-chave discutidos.",
                "",
                "## Decisões",
                "Bullets com decisões tomadas (o que foi decidido, por quem, com que condição).",
                "",
                "## Encaminhamentos / Próximos passos",
                "Bullets no formato: **Ação** — responsável — prazo (se mencionado).",
                "",
                "## Definições e conceitos",
                "Termos, definições, políticas, critérios ou regras estabelecidas durante a conversa.",
                "",
                "## Pendências e questões em aberto",
                "Dúvidas não resolvidas, riscos, bloqueios, itens que precisam de follow-up.",
                "",
                "## Números, datas e referências citadas",
                "Lista objetiva de todos os dados quantitativos, datas, links, documentos e nomes próprios citados.",
                "",
                "Regras:",
                "- Priorize COMPLETUDE sobre concisão. É melhor ficar longo do que perder informação.",
                "- Nunca invente. Se algo estiver inaudível ou incerto, marque com '[inaudível]' ou 'possivelmente ...'.",
                "- Não adicione comentários sobre o áudio nem introduções tipo 'Aqui está a ata'. Retorne DIRETAMENTE o Markdown da ata.",
              ].join("\n"),
            },
            {
              type: "input_audio",
              input_audio: {
                data: audioData,
                format: getAudioFormat(mime_type),
              },
            },
          ],
        }],
      }),
    });

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error("Meeting audio transcription failed:", transcribeResponse.status, errorText);
      throw new Error("Audio transcription failed");
    }

    const transcribeData = await transcribeResponse.json();
    const transcript = transcribeData.choices?.[0]?.message?.content?.trim() || "";
    if (!transcript) throw new Error("Empty audio transcription");

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("transcribe-meeting-audio error:", error);
    const message = error instanceof Error ? error.message : "Unexpected transcription error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
