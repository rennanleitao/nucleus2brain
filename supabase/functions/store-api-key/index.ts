import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isConfigurableAIProvider, testAIProviderConnection } from "../_shared/ai-router.ts";

type ConfigurableProvider = "openai" | "openrouter" | "google" | "anthropic" | "elevenlabs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { action = "store", provider, model, apiKey } = await req.json();
    if (!provider || !isConfigurableProvider(provider)) throw new Error("Invalid provider");

    // Store with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: existing, error: lookupError } = await supabase
      .from("user_api_keys")
      .select("id, api_key")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (action === "status") {
      return new Response(JSON.stringify({ configured: !!existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test") {
      const keyToTest = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : existing?.api_key;
      if (!keyToTest) {
        return new Response(JSON.stringify({ success: false, error: "API key não configurada." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = provider === "elevenlabs"
        ? await testElevenLabsConnection(keyToTest)
        : await testAIConnection(provider, model, keyToTest);
      if (!response.ok) {
        await response.text();
        const error = response.status === 401 || response.status === 403
          ? "API key inválida ou sem permissão."
          : response.status === 429
          ? "Limite ou créditos do provedor excedidos."
          : `O provedor recusou o teste (HTTP ${response.status}).`;
        return new Response(JSON.stringify({ success: false, error }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "store" || typeof apiKey !== "string" || !apiKey.trim()) {
      throw new Error("Missing provider or apiKey");
    }

    if (existing) {
      const { error } = await supabase.from("user_api_keys").update({ api_key: apiKey.trim() }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("user_api_keys").insert({ user_id: user.id, provider, api_key: apiKey.trim() });
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("store-api-key error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function isConfigurableProvider(value: string): value is ConfigurableProvider {
  return value === "elevenlabs" || isConfigurableAIProvider(value);
}

function testAIConnection(provider: Exclude<ConfigurableProvider, "elevenlabs">, model: unknown, apiKey: string) {
  if (!model || typeof model !== "string") throw new Error("Missing model");
  return testAIProviderConnection(provider, model, apiKey);
}

function testElevenLabsConnection(apiKey: string) {
  return fetch("https://api.elevenlabs.io/v1/user/subscription", {
    method: "GET",
    headers: {
      "xi-api-key": apiKey,
    },
  });
}
