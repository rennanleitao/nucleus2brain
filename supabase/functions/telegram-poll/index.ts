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

      // Extract link code from /start command or pasted URL
      let linkCode: string | null = null;
      if (text.startsWith("/start ")) {
        linkCode = text.slice(7).trim();
      } else if (text.includes("t.me/nucleus_reminders_bot?start=")) {
        const match = text.match(/start=([A-Za-z0-9]+)/);
        if (match) linkCode = match[1];
      }

      if (linkCode) {
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

          await sendTelegram(BOT_TOKEN, chatId, "✅ Conta vinculada com sucesso!\n\nComandos:\n/tarefas - Tarefas pendentes\n/hoje - Tarefas de hoje\n/notas - Notas recentes\n/nota <texto> - Criar nota rápida\n/tag <nome> - Buscar por tag\n/ajuda - Lista de comandos");
        } else {
          await sendTelegram(BOT_TOKEN, chatId, "❌ Código inválido ou expirado. Gere um novo nas configurações.");
        }
      } else if (text === "/start") {
        await sendTelegram(BOT_TOKEN, chatId, "👋 Olá! Eu sou o bot do Nucleus.\n\nPara vincular sua conta, acesse as configurações do Nucleus e clique em 'Vincular Telegram'.");
      } else if (text === "/tarefas" || text === "/tasks") {
        await handleTasksCommand(supabase, BOT_TOKEN, chatId);
      } else if (text === "/hoje" || text === "/today") {
        await handleTodayCommand(supabase, BOT_TOKEN, chatId);
      } else if (text.startsWith("/nota ") || text.startsWith("/note ")) {
        await handleCreateNote(supabase, BOT_TOKEN, chatId, text);
      } else if (text === "/notas" || text === "/notes") {
        await handleListNotes(supabase, BOT_TOKEN, chatId);
      } else if (text.startsWith("/tag ")) {
        await handleTagSearch(supabase, BOT_TOKEN, chatId, text);
      } else if (text === "/ajuda" || text === "/help") {
        await sendTelegram(BOT_TOKEN, chatId, 
          "📋 Comandos disponíveis:\n\n" +
          "📌 Tarefas:\n/tarefas - Ver pendentes\n/hoje - Tarefas de hoje\n\n" +
          "📝 Notas:\n/nota <texto> - Criar nota rápida\n/notas - Ver notas recentes\n/tag <nome> - Buscar por tag\n\n" +
          "💬 Texto livre - Pergunte sobre suas tarefas, notas e compromissos"
        );
      } else {
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

// ── Helpers ──

async function sendTelegram(token: string, chatId: number, text: string, parseMode?: string) {
  const body: any = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;
  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

// ── Tasks ──

async function handleTasksCommand(supabase: any, token: string, chatId: number) {
  const link = await getUserLink(supabase, chatId);
  if (!link) { await sendTelegram(token, chatId, "⚠️ Conta não vinculada. Vincule pelo Nucleus."); return; }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, priority, due_date, status")
    .eq("user_id", link.user_id)
    .in("status", ["todo", "in_progress", "waiting"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(15);

  if (!tasks || tasks.length === 0) {
    await sendTelegram(token, chatId, "✨ Nenhuma tarefa pendente!");
    return;
  }

  const icon: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };
  const lines = tasks.map((t: any) => {
    const due = t.due_date ? ` (${t.due_date})` : "";
    return `${icon[t.priority] || "⚪"} ${t.title}${due}`;
  });

  await sendTelegram(token, chatId, `📋 Tarefas pendentes:\n\n${lines.join("\n")}`);
}

async function handleTodayCommand(supabase: any, token: string, chatId: number) {
  const link = await getUserLink(supabase, chatId);
  if (!link) { await sendTelegram(token, chatId, "⚠️ Conta não vinculada."); return; }

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

  const icon: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };
  const lines = tasks.map((t: any) => `${icon[t.priority] || "⚪"} ${t.title}`);
  await sendTelegram(token, chatId, `📅 Tarefas de hoje:\n\n${lines.join("\n")}`);
}

// ── Notes ──

async function handleCreateNote(supabase: any, token: string, chatId: number, text: string) {
  const link = await getUserLink(supabase, chatId);
  if (!link) { await sendTelegram(token, chatId, "⚠️ Conta não vinculada."); return; }

  const noteText = text.replace(/^\/(nota|note)\s+/, "").trim();
  if (!noteText) {
    await sendTelegram(token, chatId, "📝 Use: /nota <texto da nota>");
    return;
  }

  // Extract tags from text (#tag)
  const tagMatches = noteText.match(/#(\w+)/g);
  const tags = tagMatches ? tagMatches.map((t: string) => t.slice(1)) : [];

  // Use first line or first 50 chars as title
  const firstLine = noteText.split("\n")[0];
  const title = firstLine.length > 60 ? firstLine.substring(0, 57) + "..." : firstLine;
  
  const { error } = await supabase.from("notes").insert({
    user_id: link.user_id,
    title,
    content: `<p>${noteText.replace(/\n/g, "</p><p>")}</p>`,
    tags: tags.length > 0 ? tags : [],
  });

  if (error) {
    await sendTelegram(token, chatId, "❌ Erro ao criar nota. Tente novamente.");
    return;
  }

  const tagInfo = tags.length > 0 ? `\nTags: ${tags.map((t: string) => `#${t}`).join(" ")}` : "";
  await sendTelegram(token, chatId, `📝 Nota criada: "${title}"${tagInfo}`);
}

async function handleListNotes(supabase: any, token: string, chatId: number) {
  const link = await getUserLink(supabase, chatId);
  if (!link) { await sendTelegram(token, chatId, "⚠️ Conta não vinculada."); return; }

  const { data: notes } = await supabase
    .from("notes")
    .select("title, tags, updated_at")
    .eq("user_id", link.user_id)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (!notes || notes.length === 0) {
    await sendTelegram(token, chatId, "📝 Nenhuma nota encontrada.");
    return;
  }

  const lines = notes.map((n: any, i: number) => {
    const tags = n.tags?.length > 0 ? ` [${n.tags.map((t: string) => `#${t}`).join(" ")}]` : "";
    const date = new Date(n.updated_at).toLocaleDateString("pt-BR");
    return `${i + 1}. ${n.title}${tags} (${date})`;
  });

  await sendTelegram(token, chatId, `📝 Notas recentes:\n\n${lines.join("\n")}`);
}

async function handleTagSearch(supabase: any, token: string, chatId: number, text: string) {
  const link = await getUserLink(supabase, chatId);
  if (!link) { await sendTelegram(token, chatId, "⚠️ Conta não vinculada."); return; }

  const tag = text.replace(/^\/tag\s+#?/, "").trim().toLowerCase();
  if (!tag) {
    await sendTelegram(token, chatId, "🏷️ Use: /tag <nome_da_tag>");
    return;
  }

  const { data: notes } = await supabase
    .from("notes")
    .select("title, tags, updated_at")
    .eq("user_id", link.user_id)
    .contains("tags", [tag])
    .order("updated_at", { ascending: false })
    .limit(10);

  if (!notes || notes.length === 0) {
    await sendTelegram(token, chatId, `🏷️ Nenhuma nota com a tag #${tag}`);
    return;
  }

  const lines = notes.map((n: any, i: number) => {
    const date = new Date(n.updated_at).toLocaleDateString("pt-BR");
    return `${i + 1}. ${n.title} (${date})`;
  });

  await sendTelegram(token, chatId, `🏷️ Notas com #${tag}:\n\n${lines.join("\n")}`);
}

// ── AI Free Text ──

async function handleFreeText(supabase: any, token: string, chatId: number, text: string, lovableApiKey: string | undefined) {
  const link = await getUserLink(supabase, chatId);
  if (!link) { await sendTelegram(token, chatId, "⚠️ Vincule sua conta primeiro."); return; }

  if (!lovableApiKey) {
    await sendTelegram(token, chatId, "Desculpe, o assistente de IA não está configurado.");
    return;
  }

  // Get user context: tasks + notes + reminders
  const [tasksRes, notesRes, remindersRes] = await Promise.all([
    supabase.from("tasks")
      .select("title, priority, due_date, status")
      .eq("user_id", link.user_id)
      .in("status", ["todo", "in_progress", "waiting"])
      .limit(20),
    supabase.from("notes")
      .select("title, tags, content, updated_at")
      .eq("user_id", link.user_id)
      .order("updated_at", { ascending: false })
      .limit(15),
    supabase.from("reminders")
      .select("*, tasks(title)")
      .eq("user_id", link.user_id)
      .eq("sent", false),
  ]);

  const context = {
    tasks: tasksRes.data || [],
    notes: (notesRes.data || []).map((n: any) => ({
      title: n.title,
      tags: n.tags,
      // Strip HTML for AI context, limit content
      content: (n.content || "").replace(/<[^>]+>/g, "").substring(0, 200),
      updated: n.updated_at,
    })),
    reminders: (remindersRes.data || []).map((r: any) => ({
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
            content: `Você é o assistente do Nucleus via Telegram. Responda de forma concisa e útil. O usuário pode perguntar sobre suas tarefas, notas, lembretes e compromissos. Aqui está o contexto:\n${JSON.stringify(context)}\n\nResponda sempre em português. Não use markdown complexo, use apenas texto simples com emojis. Se o usuário pedir para buscar em notas, procure no contexto fornecido.`,
          },
          { role: "user", content: text },
        ],
        stream: false,
      }),
    });

    if (!resp.ok) {
      await sendTelegram(token, chatId, "Desculpe, ocorreu um erro.");
      return;
    }

    const result = await resp.json();
    const reply = result.choices?.[0]?.message?.content || "Sem resposta.";
    await sendTelegram(token, chatId, reply);
  } catch {
    await sendTelegram(token, chatId, "Desculpe, ocorreu um erro. Tente novamente.");
  }
}
