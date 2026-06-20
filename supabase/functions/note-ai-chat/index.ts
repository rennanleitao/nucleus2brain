import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { routeAICompletion } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question, noteTitle, noteContent, history } = await req.json();

    // Strip HTML from note content
    const plainContent = noteContent
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const systemPrompt = `Você é um assistente inteligente que analisa notas do usuário e responde perguntas sobre elas. 

Contexto da nota:
- Título: "${noteTitle}"
- Conteúdo: """
${plainContent.slice(0, 8000)}
"""

Regras:
- Responda sempre no mesmo idioma da pergunta do usuário
- Seja conciso mas completo
- Use formatação Markdown quando apropriado (bullet points, negrito, etc.)
- Se a pergunta não puder ser respondida com base no conteúdo da nota, diga isso claramente
- Quando identificar ações, use checkbox markdown (- [ ] ação)
- Separe seções com linhas horizontais (---) quando a resposta for longa`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history for context
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: question });

    const { response, provider } = await routeAICompletion(
      req,
      { messages },
      { defaultModel: "google/gemini-3-flash-preview" },
    );

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
      console.error(`${provider} AI error:`, response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || "Não foi possível gerar uma resposta.";

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("note-ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
