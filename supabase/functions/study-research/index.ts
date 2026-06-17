import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Source { title: string; url: string; snippet?: string }

async function firecrawlSearch(query: string): Promise<Source[]> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return [];
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5 }),
    });
    if (!r.ok) return [];
    const d = await r.json();
    const items = d?.data?.web ?? d?.data ?? [];
    return (items as any[]).slice(0, 5).map((x) => ({
      title: x.title ?? x.url,
      url: x.url,
      snippet: x.description ?? x.snippet ?? "",
    }));
  } catch (e) {
    console.error("firecrawl search error", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question, topicTitle, topicDescription, entries, history } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Try live web search via Firecrawl (optional)
    const sources = await firecrawlSearch(`${topicTitle} ${question}`);

    const timelineCtx = (entries ?? [])
      .slice(0, 20)
      .map((e: any) => `- [${e.entry_date}] ${e.title}: ${e.summary ?? ""}`)
      .join("\n");

    const sourcesBlock = sources.length
      ? sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${s.snippet ?? ""}`).join("\n\n")
      : "";

    const systemPrompt = `Você é um assistente de pesquisa dentro do Nucleus, complementando estudos de um tema.

Tema: "${topicTitle}"
${topicDescription ? `Descrição: ${topicDescription}` : ""}

Timeline atual do estudo (contexto):
${timelineCtx || "(vazio)"}

${sourcesBlock ? `Resultados de busca web (use APENAS estes para dados atuais e cite com [n]):\n\n${sourcesBlock}\n` : "Sem resultados de busca web disponíveis. Use seu conhecimento, mas avise quando o dado puder estar desatualizado e sugira fontes oficiais com URL completa."}

Regras:
- Responda no idioma da pergunta (PT-BR por padrão).
- Seja conciso, direto, estilo consultoria sênior.
- Para dados quantitativos (taxas, índices, datas), SEMPRE inclua a fonte com link.
- Ao final, liste "Fontes:" como bullets com título e URL clicável em markdown: [título](url).
- Use markdown (negrito, listas) quando ajudar.`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];
    if (Array.isArray(history)) for (const m of history) messages.push({ role: m.role, content: m.content });
    messages.push({ role: "user", content: question });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições. Tente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || "Não foi possível gerar resposta.";

    return new Response(JSON.stringify({ answer, sources }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("study-research error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
