import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function recallBaseUrl() {
  const configuredRegion = Deno.env.get("RECALL_REGION")?.trim();
  const validRegions = new Set(["us-west-2", "us-east-1", "eu-central-1", "ap-northeast-1"]);
  const region = configuredRegion && validRegions.has(configuredRegion)
    ? configuredRegion
    : "us-west-2";
  if (configuredRegion && configuredRegion !== region) {
    console.warn(`Invalid RECALL_REGION "${configuredRegion}". Falling back to ${region}.`);
  }
  return `https://${region}.recall.ai/api/v1`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RECALL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "RECALL_API_KEY não configurada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const sessionId = typeof body.session_id === "string" ? body.session_id : "";
    const meetingUrl = typeof body.meeting_url === "string" ? body.meeting_url.trim() : "";
    const botName = typeof body.bot_name === "string" && body.bot_name.trim()
      ? body.bot_name.trim()
      : "Nucleus Copilot";
    const languageCode = typeof body.language_code === "string" && body.language_code.trim()
      ? body.language_code.trim()
      : "pt";

    if (!sessionId || !meetingUrl) {
      return new Response(JSON.stringify({ error: "session_id and meeting_url are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookToken = Deno.env.get("RECALL_WEBHOOK_TOKEN");
    const webhookUrl = webhookToken
      ? `${supabaseUrl}/functions/v1/meeting-bot-webhook/?token=${encodeURIComponent(webhookToken)}`
      : `${supabaseUrl}/functions/v1/meeting-bot-webhook`;

    const recallResponse = await fetch(`${recallBaseUrl()}/bot/`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: botName,
        metadata: {
          nucleus_session_id: sessionId,
          nucleus_user_id: user.id,
        },
        recording_config: {
          transcript: {
            provider: {
              recallai_streaming: {
                mode: "prioritize_low_latency",
                language_code: languageCode,
              },
            },
            diarization: {
              use_separate_streams_when_available: true,
            },
          },
          realtime_endpoints: [
            {
              type: "webhook",
              url: webhookUrl,
              events: ["transcript.data"],
              metadata: {
                nucleus_session_id: sessionId,
              },
            },
          ],
        },
      }),
    });

    const recallText = await recallResponse.text();
    let recallData: Record<string, unknown> = {};
    try {
      recallData = recallText ? JSON.parse(recallText) : {};
    } catch {
      recallData = { raw: recallText };
    }

    if (!recallResponse.ok) {
      return new Response(JSON.stringify({
        error: "Recall.ai não conseguiu criar o bot.",
        details: recallData,
      }), {
        status: recallResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botId = typeof recallData.id === "string" ? recallData.id : null;
    const { data: session, error } = await supabase
      .from("meeting_copilot_sessions")
      .update({
        provider: "recall",
        meeting_url: meetingUrl,
        bot_id: botId,
        bot_name: botName,
        bot_status: "created",
        bot_error: null,
      })
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ session, bot: recallData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("meeting-bot error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
