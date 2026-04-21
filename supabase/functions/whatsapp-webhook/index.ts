import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// BRT (America/Sao_Paulo) — canonical app timezone.
function getBrtToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { message, phone, webhook_secret, audio_url, audio_base64 } = body;

    if (!webhook_secret || (!message && !audio_url && !audio_base64)) {
      return new Response(JSON.stringify({ error: "Missing webhook_secret and message/audio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find user by webhook_secret
    const { data: settings, error: settingsError } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("webhook_secret", webhook_secret)
      .eq("enabled", true)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: "Invalid webhook secret or integration disabled" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = settings.user_id;

    // Use AI to parse the command
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // If audio, first transcribe it using Gemini multimodal
    let textMessage = message || "";
    if (!textMessage && (audio_url || audio_base64)) {
      let audioData = audio_base64;
      
      // Download audio if URL provided
      if (audio_url && !audioData) {
        try {
          const audioResp = await fetch(audio_url);
          if (!audioResp.ok) throw new Error(`Failed to download audio: ${audioResp.status}`);
          const audioBuffer = await audioResp.arrayBuffer();
          audioData = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
        } catch (e) {
          console.error("Audio download error:", e);
          throw new Error("Failed to download audio file");
        }
      }

      if (audioData) {
        // Use Gemini to transcribe audio
        const transcribeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: "Transcreva este áudio exatamente como falado. Retorne APENAS a transcrição, sem explicações." },
                {
                  type: "input_audio",
                  input_audio: {
                    data: audioData,
                    format: "mp3",
                  },
                },
              ],
            }],
          }),
        });

        if (!transcribeResponse.ok) {
          const errText = await transcribeResponse.text();
          console.error("Transcription error:", transcribeResponse.status, errText);
          throw new Error("Audio transcription failed");
        }

        const transcribeData = await transcribeResponse.json();
        textMessage = transcribeData.choices?.[0]?.message?.content || "";
        console.log("Transcribed audio:", textMessage);

        if (!textMessage.trim()) {
          throw new Error("Could not transcribe audio");
        }
      }
    }

    const systemPrompt = `You are a task management assistant that interprets WhatsApp messages in Portuguese or English.
Parse the user's message and determine the action. Return a JSON tool call.

Available actions:
- "create": Create a new task. Extract title, description, priority (low/medium/high), due_date (ISO format if mentioned).
- "list": List tasks. Optional filter: "today", "overdue", "all", "pending".
- "complete": Mark task as completed. Extract the task title or partial match.
- "delete": Delete a task. Extract the task title or partial match.
- "help": Show available commands.

For dates, today (Brasília time) is ${getBrtToday()}. Interpret relative dates like "amanhã", "próxima segunda", etc.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: textMessage }
        ],
        tools: [{
          type: "function",
          function: {
            name: "execute_command",
            description: "Execute a task management command",
            parameters: {
              type: "object",
              properties: {
                action: { type: "string", enum: ["create", "list", "complete", "delete", "help"] },
                title: { type: "string", description: "Task title for create/complete/delete" },
                description: { type: "string", description: "Task description for create" },
                priority: { type: "string", enum: ["low", "medium", "high"] },
                due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
                filter: { type: "string", enum: ["today", "overdue", "all", "pending"] },
              },
              required: ["action"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "execute_command" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI parsing failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call returned from AI");

    const cmd = JSON.parse(toolCall.function.arguments);
    let reply = "";

    switch (cmd.action) {
      case "create": {
        const { error } = await supabase.from("tasks").insert({
          user_id: userId,
          title: cmd.title || "Nova task",
          description: cmd.description || null,
          priority: cmd.priority || "medium",
          due_date: cmd.due_date || null,
          status: cmd.due_date ? "in_progress" : "todo",
        });
        if (error) throw error;
        reply = `✅ Task criada: *${cmd.title}*${cmd.due_date ? `\n📅 Prazo: ${cmd.due_date}` : ""}${cmd.priority ? `\n🔥 Prioridade: ${cmd.priority}` : ""}`;
        break;
      }

      case "list": {
        let query = supabase.from("tasks").select("title, priority, due_date, status, spaces(name)")
          .eq("user_id", userId)
          .not("status", "in", '("completed","cancelled")')
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(15);

        if (cmd.filter === "today") {
          const today = getBrtToday();
          query = query.eq("due_date", today);
        } else if (cmd.filter === "overdue") {
          const today = getBrtToday();
          query = query.lt("due_date", today);
        }

        const { data: tasks, error } = await query;
        if (error) throw error;

        if (!tasks || tasks.length === 0) {
          reply = "📋 Nenhuma task encontrada.";
        } else {
          const priorityEmoji: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };
          reply = `📋 *Suas tasks (${tasks.length}):*\n\n` + tasks.map((t: any, i: number) => {
            const emoji = priorityEmoji[t.priority] || "⚪";
            const date = t.due_date ? ` (${t.due_date})` : "";
            const space = t.spaces?.name ? ` [${t.spaces.name}]` : "";
            return `${i + 1}. ${emoji} ${t.title}${date}${space}`;
          }).join("\n");
        }
        break;
      }

      case "complete": {
        const { data: tasks } = await supabase.from("tasks").select("id, title")
          .eq("user_id", userId)
          .not("status", "in", '("completed","cancelled")')
          .ilike("title", `%${cmd.title}%`)
          .limit(1);

        if (tasks && tasks.length > 0) {
          await supabase.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", tasks[0].id);
          reply = `✅ Task concluída: *${tasks[0].title}*`;
        } else {
          reply = `❌ Não encontrei a task "${cmd.title}". Tente "listar tasks" para ver suas tasks.`;
        }
        break;
      }

      case "delete": {
        const { data: tasks } = await supabase.from("tasks").select("id, title")
          .eq("user_id", userId)
          .ilike("title", `%${cmd.title}%`)
          .limit(1);

        if (tasks && tasks.length > 0) {
          await supabase.from("tasks").delete().eq("id", tasks[0].id);
          reply = `🗑️ Task excluída: *${tasks[0].title}*`;
        } else {
          reply = `❌ Não encontrei a task "${cmd.title}".`;
        }
        break;
      }

      case "help":
      default: {
        reply = `🤖 *Comandos disponíveis:*\n\n` +
          `📝 *Criar task:* "criar task: Reunião com João amanhã"\n` +
          `📋 *Listar tasks:* "listar tasks", "tasks de hoje", "tasks atrasadas"\n` +
          `✅ *Concluir:* "concluir Reunião com João"\n` +
          `🗑️ *Excluir:* "excluir Reunião com João"\n` +
          `❓ *Ajuda:* "ajuda" ou "help"`;
        break;
      }
    }

    // Send reply back via Zapier webhook if configured
    if (settings.zapier_webhook_url) {
      try {
        await fetch(settings.zapier_webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phone || settings.phone_number, message: reply }),
        });
      } catch (e) {
        console.error("Failed to send reply via Zapier:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, reply }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-webhook error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
