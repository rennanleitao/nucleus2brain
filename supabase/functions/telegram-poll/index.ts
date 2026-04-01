import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_API = "https://api.telegram.org";

serve(async () => {
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 55_000;
  const MIN_REMAINING_MS = 5_000;

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  let totalProcessed = 0;

  // Read initial offset
  const { data: state, error: stateErr } = await supabase
    .from("telegram_bot_state")
    .select("update_offset")
    .eq("id", 1)
    .single();

  if (stateErr) {
    return new Response(JSON.stringify({ error: stateErr.message }), { status: 500 });
  }

  let currentOffset = state.update_offset;

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    const response = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/getUpdates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offset: currentOffset,
        timeout,
        allowed_updates: ["message"],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data }), { status: 502 });
    }

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    for (const update of updates) {
      if (!update.message) continue;

      const chatId = update.message.chat.id;
      const text = update.message.text || "";
      const username = update.message.from?.username || update.message.from?.first_name || "";

      // Handle /start command — link user
      if (text.startsWith("/start ")) {
        const linkCode = text.slice(7).trim();
        if (linkCode) {
          // Find user by link_code and update chat_id
          const { data: existing } = await supabase
            .from("telegram_chat_links")
            .select("id, user_id")
            .eq("link_code", linkCode)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("telegram_chat_links")
              .update({ chat_id: chatId, username, enabled: true, link_code: null })
              .eq("id", existing.id);

            await sendTelegram(BOT_TOKEN, chatId, "✅ Conta vinculada com sucesso! Você receberá lembretes e poderá consultar suas tarefas por aqui.\n\nComandos:\n/tarefas - Ver tarefas pendentes\n/hoje - Tarefas de hoje\n/ajuda - Lista de comandos");
          } else {
            await sendTelegram(BOT_TOKEN, chatId, "❌ Código de vinculação inválido ou expirado. Gere um novo código nas configurações do Nucleus.");
          }
        }
      } else if (text === "/start") {
        await sendTelegram(BOT_TOKEN, chatId, "👋 Olá! Eu sou o bot do Nucleus.\n\nPara vincular sua conta, acesse as configurações do Nucleus e clique em 'Vincular Telegram'.");
      } else if (text === "/tarefas" || text === "/tasks") {
        await handleTasksCommand(supabase, BOT_TOKEN, chatId);
      } else if (text === "/hoje" || text === "/today") {
        await handleTodayCommand(supabase, BOT_TOKEN, chatId);
      } else if (text === "/ajuda" || text === "/help") {
        await sendTelegram(BOT_TOKEN, chatId, "📋 *Comandos disponíveis:*\n\n/tarefas \\- Ver todas as tarefas pendentes\n/hoje \\- Tarefas de hoje\n/ajuda \\- Esta mensagem\n\nVocê também pode enviar qualquer pergunta sobre suas tarefas e compromissos\\!", "MarkdownV2");
      } else {
        // Free-text: use AI to process
        await handleFreeText(supabase, BOT_TOKEN, chatId, text, LOVABLE_API_KEY);
      }
    }

    totalProcessed += updates.length;

    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from("telegram_bot_state")
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq("id", 1);

    currentOffset = newOffset;
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed }));
});

async function sendTelegram(token: string, chatId: number, text: string, parseMode?: string) {
  const body: any = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;
  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function handleTasksCommand(supabase: any, token: string, chatId: number) {
  const link = await getUserLink(supabase, chatId);
  if (!link) {
    await sendTelegram(token, chatId, "⚠️ Conta não vinculada. Vincule pelo Nucleus em Configurações.");
    return;
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, priority, due_date, status")
    .eq("user_id", link.user_id)
    .in("status", ["todo", "in_progress", "waiting"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(15);

  if (!tasks || tasks.length === 0) {
    await sendTelegram(token, chatId, "✨ Nenhuma tarefa pendente! Você está em dia.");
    return;
  }

  const priorityIcon: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };
  const lines = tasks.map((t: any) => {
    const icon = priorityIcon[t.priority] || "⚪";
    const due = t.due_date ? ` (${t.due_date})` : "";
    return `${icon} ${t.title}${due}`;
  });

  await sendTelegram(token, chatId, `📋 *Tarefas pendentes:*\n\n${lines.join("\n")}`, "Markdown");
}

async function handleTodayCommand(supabase: any, token: string, chatId: number) {
  const link = await getUserLink(supabase, chatId);
  if (!link) {
    await sendTelegram(token, chatId, "⚠️ Conta não vinculada.");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, priority, status")
    .eq("user_id", link.user_id)
    .eq("due_date", today)
    .in("status", ["todo", "in_progress", "waiting"]);

  if (!tasks || tasks.length === 0) {
    await sendTelegram(token, chatId, "📅 Nenhuma tarefa para hoje!");
    return;
  }

  const priorityIcon: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };
  const lines = tasks.map((t: any) => {
    const icon = priorityIcon[t.priority] || "⚪";
    return `${icon} ${t.title}`;
  });

  await sendTelegram(token, chatId, `📅 *Tarefas de hoje:*\n\n${lines.join("\n")}`, "Markdown");
}

async function handleFreeText(supabase: any, token: string, chatId: number, text: string, lovableApiKey: string | undefined) {
  const link = await getUserLink(supabase, chatId);
  if (!link) {
    await sendTelegram(token, chatId, "⚠️ Vincule sua conta primeiro nas configurações do Nucleus.");
    return;
  }

  if (!lovableApiKey) {
    await sendTelegram(token, chatId, "Desculpe, o assistente de IA não está configurado.");
    return;
  }

  // Get user context
  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, priority, due_date, status")
    .eq("user_id", link.user_id)
    .in("status", ["todo", "in_progress", "waiting"])
    .limit(20);

  const { data: reminders } = await supabase
    .from("reminders")
    .select("*, tasks(title)")
    .eq("user_id", link.user_id)
    .eq("sent", false);

  const context = {
    tasks: tasks || [],
    reminders: (reminders || []).map((r: any) => ({
      task: r.tasks?.title,
      time: r.reminder_time,
    })),
    today: new Date().toISOString().split("T")[0],
  };

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é o assistente do Nucleus via Telegram. Responda de forma concisa e útil. O usuário pode perguntar sobre suas tarefas, lembretes e compromissos. Aqui está o contexto: ${JSON.stringify(context)}. Responda sempre em português. Não use markdown complexo, use apenas texto simples com emojis.`,
          },
          { role: "user", content: text },
        ],
        stream: false,
      }),
    });

    if (!resp.ok) {
      await sendTelegram(token, chatId, "Desculpe, ocorreu um erro ao processar sua mensagem.");
      return;
    }

    const result = await resp.json();
    const reply = result.choices?.[0]?.message?.content || "Sem resposta.";
    await sendTelegram(token, chatId, reply);
  } catch {
    await sendTelegram(token, chatId, "Desculpe, ocorreu um erro. Tente novamente.");
  }
}

async function getUserLink(supabase: any, chatId: number) {
  const { data } = await supabase
    .from("telegram_chat_links")
    .select("user_id")
    .eq("chat_id", chatId)
    .eq("enabled", true)
    .maybeSingle();
  return data;
}
