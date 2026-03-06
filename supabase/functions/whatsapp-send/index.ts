import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check for pending reminders
    const now = new Date().toISOString();
    const { data: reminders, error: remError } = await supabase
      .from("reminders")
      .select("*, tasks(title)")
      .eq("sent", false)
      .lte("reminder_time", now);

    if (remError) throw remError;
    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;

    for (const reminder of reminders) {
      // Get user's WhatsApp settings
      const { data: settings } = await supabase
        .from("whatsapp_settings")
        .select("*")
        .eq("user_id", reminder.user_id)
        .eq("enabled", true)
        .maybeSingle();

      if (settings?.zapier_webhook_url) {
        const taskTitle = (reminder as any).tasks?.title || "Task";
        const message = `⏰ *Lembrete:* ${taskTitle}`;

        try {
          await fetch(settings.zapier_webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: settings.phone_number,
              message,
            }),
          });
          sentCount++;
        } catch (e) {
          console.error("Failed to send WhatsApp reminder:", e);
        }
      }

      // Mark reminder as sent regardless
      await supabase.from("reminders").update({ sent: true }).eq("id", reminder.id);
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-send error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
