import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TELEGRAM_API = "https://api.telegram.org";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, user_id, message } = await req.json();

    if (action === "send_reminder") {
      // Send a reminder message to a user's Telegram
      if (!user_id || !message) {
        return new Response(JSON.stringify({ error: "user_id and message required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: link } = await supabase
        .from("telegram_chat_links")
        .select("chat_id")
        .eq("user_id", user_id)
        .eq("enabled", true)
        .maybeSingle();

      if (!link) {
        return new Response(JSON.stringify({ error: "No Telegram linked", sent: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resp = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: link.chat_id,
          text: message,
        }),
      });

      const result = await resp.json();

      return new Response(JSON.stringify({ sent: resp.ok, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_reminders") {
      // Check for due reminders and send them via Telegram
      const now = new Date().toISOString();
      const { data: reminders } = await supabase
        .from("reminders")
        .select("*, tasks(title)")
        .eq("sent", false)
        .lte("reminder_time", now);

      if (!reminders || reminders.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let sentCount = 0;

      for (const reminder of reminders) {
        const taskTitle = reminder.tasks?.title || "Tarefa";

        // Find Telegram chat for this user
        const { data: link } = await supabase
          .from("telegram_chat_links")
          .select("chat_id")
          .eq("user_id", reminder.user_id)
          .eq("enabled", true)
          .maybeSingle();

        if (link) {
          await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: link.chat_id,
              text: `⏰ *Lembrete:* ${taskTitle}`,
              parse_mode: "Markdown",
            }),
          });
          sentCount++;
        }

        // Mark as sent
        await supabase.from("reminders").update({ sent: true }).eq("id", reminder.id);
      }

      return new Response(JSON.stringify({ sent: sentCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-send error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
