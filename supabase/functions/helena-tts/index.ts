import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_TEXT_LENGTH = 4000;
const DEFAULT_HELENA_VOICE_ID = "KHmfNHtEjHhLK9eER20w";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const { userId, serviceClient } = await authenticate(req);

    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return json({ error: "Texto obrigatório." }, 400);
    }

    const preparedText = text.trim().slice(0, MAX_TEXT_LENGTH);
    const apiKey = await resolveElevenLabsApiKey(userId, serviceClient);
    const voiceId = Deno.env.get("HELENA_ELEVENLABS_VOICE_ID") || DEFAULT_HELENA_VOICE_ID;

    if (!apiKey || !voiceId) {
      return json({ error: "ElevenLabs não está configurado para a Helena." }, 500);
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: preparedText,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.85,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const upstreamError = await response.text();
      console.error("helena-tts upstream error:", response.status, upstreamError);
      return json({ error: "ElevenLabs recusou a geração de áudio." }, response.status === 401 ? 500 : 502);
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("helena-tts error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Not authenticated" ? 401 : 500;
    return json({ error: message }, status);
  }
});

async function authenticate(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Not authenticated");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  return {
    userId: user.id,
    serviceClient: serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null,
  };
}

async function resolveElevenLabsApiKey(
  userId: string,
  serviceClient: ReturnType<typeof createClient> | null,
) {
  if (serviceClient) {
    const { data, error } = await serviceClient
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", userId)
      .eq("provider", "elevenlabs")
      .maybeSingle();
    if (error) throw new Error(`Unable to load ElevenLabs API key: ${error.message}`);
    if (data?.api_key) return data.api_key;
  }

  return Deno.env.get("ELEVENLABS_API_KEY") || "";
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
