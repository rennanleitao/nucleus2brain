import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// BRT (America/Sao_Paulo) — canonical app timezone.
function getBrtToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, spaces } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "No transcript provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const spacesContext = spaces?.length
      ? `Available spaces (use exact id if user mentions one): ${JSON.stringify(spaces)}`
      : "No spaces available.";

    const systemPrompt = `You parse voice-transcribed text into structured task data. Return ONLY valid JSON, no markdown.

${spacesContext}

Rules:
- Extract the main task title
- If the user mentions subtasks or sub-items, extract them as subtasks array
- If the user mentions a space name, match it to the closest available space and return its id
- Detect priority keywords: urgent/critical/alta = high, normal/média = medium, baixa/low = low
- Detect date keywords: hoje/today, amanhã/tomorrow, próxima semana/next week
- Default priority is "medium"
- Dates should be in YYYY-MM-DD format based on today (Brasília time): ${getBrtToday()}

Return JSON:
{
  "title": "string",
  "description": "string or null",
  "priority": "low" | "medium" | "high",
  "due_date": "YYYY-MM-DD or null",
  "space_id": "uuid or null",
  "subtasks": [{ "title": "string", "due_date": "YYYY-MM-DD or null" }]
}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: transcript },
          ],
          temperature: 0.1,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI Gateway error: ${err}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    // Strip markdown code fences if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
