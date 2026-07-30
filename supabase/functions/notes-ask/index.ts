import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { routeAICompletion } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question, scopeLabel, notes } = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Pergunta inválida." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(notes) || notes.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma nota disponível para consulta." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Budget the context: cap per note and overall so large collections still fit.
    const perNoteLimit = notes.length > 30 ? 1200 : notes.length > 12 ? 2500 : 5000;
    let budget = 90000;
    const blocks: string[] = [];
    for (const n of notes.slice(0, 80)) {
      const plain = stripHtml(String(n?.content ?? "")).slice(0, perNoteLimit);
      const block = `### Nota: ${String(n?.title ?? "Sem título")} [id:${n?.id ?? ""}]\n${plain || "(vazia)"}\n`;
      if (budget - block.length < 0) break;
      budget -= block.length;
      blocks.push(block);
    }

    const systemPrompt = `Você é um assistente que responde perguntas sobre um conjunto de notas do usuário${
      scopeLabel ? ` (${scopeLabel})` : ""
    }.

Notas disponíveis:
"""
${blocks.join("\n")}
"""

Regras:
- Responda no mesmo idioma da pergunta.
- Sempre cite o título das notas usadas na resposta, em negrito.
- Seja direto: primeiro a resposta, depois os trechos relevantes.
- Se a informação não estiver nas notas, diga claramente que não encontrou.
- Não invente conteúdo que não esteja nas notas.
- Use Markdown simples (parágrafos curtos e bullets).`;

    const { response, provider } = await routeAICompletion(
      req,
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
      },
      { defaultModel: "google/gemini-3-flash-preview" },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em instantes." }), {
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
    console.error("notes-ask error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
