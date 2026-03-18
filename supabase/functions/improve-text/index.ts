import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, mode, extraInstructions } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompts: Record<string, string> = {
      improve: `Melhore o texto a seguir, tornando-o mais claro, conciso e profissional. Mantenha o mesmo idioma e tom. Retorne APENAS o texto melhorado, sem explicações ou aspas:\n\n${text}`,
      simplify: `Simplifique o texto a seguir, usando linguagem mais direta e fácil de entender. Mantenha o mesmo idioma. Retorne APENAS o texto simplificado, sem explicações ou aspas:\n\n${text}`,
      expand: `Expanda o texto a seguir, adicionando mais detalhes e contexto sem alterar o sentido original. Mantenha o mesmo idioma. Retorne APENAS o texto expandido, sem explicações ou aspas:\n\n${text}`,
      formal: `Reescreva o texto a seguir em tom mais formal e profissional. Mantenha o mesmo idioma. Retorne APENAS o texto reescrito, sem explicações ou aspas:\n\n${text}`,
      meeting: `Você é um especialista em organizar notas de reunião. Analise o texto abaixo e reorganize-o em formato estruturado usando o mesmo idioma do texto original. Use formatação Markdown.

A estrutura DEVE conter estas seções:

## Resumo
Um parágrafo curto resumindo o contexto e os principais pontos discutidos.

## Key Takeaways
Lista dos pontos mais importantes e decisões tomadas na reunião, como bullet points.

## Ações Possíveis para Validação
Lista de ações de seguimento identificadas, com responsáveis (se mencionados) e prazos (se mencionados). Cada item como checkbox markdown (- [ ] ação).

## Insights
(Inclua esta seção APENAS se houver insights relevantes que não são óbvios, como padrões, riscos, oportunidades ou conexões entre temas mencionados. Se não houver insights relevantes, omita esta seção completamente.)

${extraInstructions ? `INSTRUÇÕES ADICIONAIS DO USUÁRIO (aplique estas orientações na organização):\n${extraInstructions}\n\n` : ""}Retorne APENAS o conteúdo reorganizado em Markdown, sem explicações adicionais antes ou depois:\n\n${text}`,
    };

    const systemPrompt = prompts[mode] || prompts.improve;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional text editor. Follow the instructions exactly." },
          { role: "user", content: systemPrompt },
        ],
      }),
    });

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
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const improved = data.choices?.[0]?.message?.content?.trim() || text;

    return new Response(JSON.stringify({ improved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("improve-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
