import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Search, RefreshCw, Reply, Archive, Trash2, Send, ArrowLeft, Link2, Loader2, Inbox } from "lucide-react";
import {
  listMessages, getMessage, getThread, modifyMessage, trashMessage,
  sendRawEmail, buildReplyRfc2822, extractBody, getHeader, parseAddress, formatDate,
  type GmailMessage,
} from "@/lib/gmail";
import { fetchTasks, fetchNotes, createTask, createNote } from "@/lib/api";

type ConnectionInfo = { email: string | null; connected_at: string; scopes: string | null };

type ListRow = { id: string; threadId: string; msg?: GmailMessage; loading?: boolean };

export default function Emails() {
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [checkingConn, setCheckingConn] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextPage, setNextPage] = useState<string | undefined>();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const loadConnection = async () => {
    setCheckingConn(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCheckingConn(false); return; }
    const { data } = await supabase
      .from("gmail_connections")
      .select("email, connected_at, scopes")
      .eq("user_id", user.id)
      .maybeSingle();
    setConnection(data as ConnectionInfo | null);
    setCheckingConn(false);
  };

  useEffect(() => { loadConnection(); }, []);

  // Listen for the popup completion message
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "nucleus_gmail_connected") {
        toast.success("Gmail conectado.");
        loadConnection();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const startConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-connect", {
        body: { app_return_url: `${window.location.origin}/emails` },
      });
      if (error) throw new Error(error.message || "Falha ao iniciar OAuth");
      const url = (data as { authorization_url?: string })?.authorization_url;
      if (!url) throw new Error("Sem URL de autorização");
      const w = window.open(url, "nucleus_gmail", "width=520,height=680,menubar=no,toolbar=no");
      if (!w) window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao conectar");
    } finally {
      setConnecting(false);
    }
  };

  const fetchInbox = async (opts: { q?: string; pageToken?: string; append?: boolean } = {}) => {
    setLoading(true);
    try {
      const q = opts.q ?? activeQuery;
      const composedQ = q ? q : "in:inbox";
      const res = await listMessages({ q: composedQ, maxResults: 25, pageToken: opts.pageToken });
      const list = (res.messages ?? []).map((m) => ({ id: m.id, threadId: m.threadId, loading: true } as ListRow));
      setRows(opts.append ? (prev) => [...prev, ...list] : list);
      setNextPage(res.nextPageToken);
      // Hydrate metadata in parallel
      list.forEach(async (row) => {
        try {
          const msg = await getMessage(row.id, "metadata");
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, msg, loading: false } : r)));
        } catch {
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, loading: false } : r)));
        }
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      if (err.includes("not_connected")) {
        toast.error("Gmail não conectado.");
        setConnection(null);
      } else {
        toast.error("Falha ao carregar inbox: " + err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connection) fetchInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.email]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(query);
    fetchInbox({ q: query });
  };

  if (checkingConn) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-muted mb-5">
          <Mail className="h-6 w-6 text-foreground" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Conecte seu Gmail</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
          Leia, responda e organize e-mails direto do Nucleus. Cada e-mail pode virar (ou ser vinculado a) uma task ou nota,
          mantendo tudo integrado ao seu planejamento.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button onClick={startConnect} disabled={connecting} size="lg">
            {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Conectar Gmail
          </Button>
          <p className="text-[11px] text-muted-foreground max-w-sm">
            Você será redirecionado para o Google. O Nucleus armazena apenas uma credencial de acesso — sua senha nunca é vista.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <header className="border-b border-border/60 px-6 py-4 flex items-center gap-3">
        <Inbox className="h-5 w-5 text-foreground" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight leading-tight">E-mails</h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{connection.email}</p>
        </div>
        <form onSubmit={submitSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-9 w-64"
              placeholder="Buscar (ex: from:foo is:unread)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => fetchInbox()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </form>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <MessageList
          rows={rows}
          selectedThreadId={selectedThreadId}
          onSelect={(row) => setSelectedThreadId(row.threadId)}
          loading={loading}
          nextPage={nextPage}
          onLoadMore={() => fetchInbox({ pageToken: nextPage, append: true })}
        />
        <ThreadView
          threadId={selectedThreadId}
          onClose={() => setSelectedThreadId(null)}
          onChanged={() => {
            // Re-fetch metadata for the affected messages (mark-as-read, archive, trash)
            fetchInbox();
          }}
        />
      </div>
    </div>
  );
}

function MessageList({ rows, selectedThreadId, onSelect, loading, nextPage, onLoadMore }: {
  rows: ListRow[];
  selectedThreadId: string | null;
  onSelect: (row: ListRow) => void;
  loading: boolean;
  nextPage?: string;
  onLoadMore: () => void;
}) {
  return (
    <div className="w-full max-w-md border-r border-border/60 overflow-y-auto">
      {rows.length === 0 && !loading && (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhum e-mail.</div>
      )}
      <ul className="divide-y divide-border/60">
        {rows.map((row) => {
          const msg = row.msg;
          const from = msg ? parseAddress(getHeader(msg, "From")) : { email: "…" };
          const subject = msg ? getHeader(msg, "Subject") : "";
          const isUnread = msg?.labelIds?.includes("UNREAD") ?? false;
          const selected = row.threadId === selectedThreadId;
          return (
            <li key={row.id}>
              <button
                onClick={() => onSelect(row)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selected ? "bg-muted" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`text-sm truncate ${isUnread ? "font-semibold text-foreground" : "text-foreground/85"}`}>
                    {from.name || from.email}
                  </span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(msg?.internalDate)}</span>
                </div>
                <p className={`text-sm truncate mt-0.5 ${isUnread ? "font-medium" : ""}`}>{subject || "(sem assunto)"}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{msg?.snippet}</p>
              </button>
            </li>
          );
        })}
      </ul>
      {nextPage && (
        <div className="p-3 text-center">
          <Button variant="ghost" size="sm" onClick={onLoadMore} disabled={loading}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}

function ThreadView({ threadId, onClose, onChanged }: { threadId: string | null; onClose: () => void; onChanged: () => void }) {
  const [thread, setThread] = useState<Awaited<ReturnType<typeof getThread>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  useEffect(() => {
    if (!threadId) { setThread(null); return; }
    setLoading(true);
    getThread(threadId)
      .then(async (t) => {
        setThread(t);
        // Auto mark-as-read: for each unread message, remove UNREAD label
        const unread = t.messages.filter((m) => m.labelIds?.includes("UNREAD"));
        if (unread.length) {
          await Promise.all(unread.map((m) => modifyMessage(m.id, [], ["UNREAD"]).catch(() => null)));
          onChanged();
        }
      })
      .catch((e) => toast.error("Erro ao carregar thread: " + e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  if (!threadId) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Selecione um e-mail para abrir.
      </div>
    );
  }

  const latest = thread?.messages[thread.messages.length - 1];
  const subject = latest ? getHeader(latest, "Subject") : "";

  const doArchive = async () => {
    if (!thread) return;
    try {
      await Promise.all(thread.messages.map((m) => modifyMessage(m.id, [], ["INBOX"])));
      toast.success("Arquivado.");
      onClose(); onChanged();
    } catch (e) { toast.error("Erro: " + (e as Error).message); }
  };
  const doTrash = async () => {
    if (!thread) return;
    try {
      await Promise.all(thread.messages.map((m) => trashMessage(m.id)));
      toast.success("Movido para a lixeira.");
      onClose(); onChanged();
    } catch (e) { toast.error("Erro: " + (e as Error).message); }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border/60 px-6 py-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft className="h-4 w-4" /></Button>
        <h2 className="flex-1 text-base font-semibold tracking-tight truncate">{subject || "(sem assunto)"}</h2>
        <Button variant="ghost" size="sm" onClick={() => setLinkOpen(true)}><Link2 className="h-4 w-4 mr-1.5" />Vincular</Button>
        <Button variant="ghost" size="sm" onClick={() => setReplyOpen(true)}><Reply className="h-4 w-4 mr-1.5" />Responder</Button>
        <Button variant="ghost" size="sm" onClick={doArchive}><Archive className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={doTrash}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {thread?.messages.map((m) => <MessageBody key={m.id} msg={m} />)}
      </div>
      {latest && replyOpen && (
        <ReplyDialog latest={latest} onClose={() => setReplyOpen(false)} onSent={() => { setReplyOpen(false); onChanged(); }} />
      )}
      {latest && linkOpen && (
        <LinkDialog latest={latest} onClose={() => setLinkOpen(false)} />
      )}
    </div>
  );
}

function MessageBody({ msg }: { msg: GmailMessage }) {
  const from = parseAddress(getHeader(msg, "From"));
  const to = getHeader(msg, "To");
  const date = getHeader(msg, "Date");
  const body = extractBody(msg);
  return (
    <div className="border-b border-border/60 px-6 py-5">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div>
          <p className="text-sm font-medium">{from.name || from.email}</p>
          <p className="text-[11px] text-muted-foreground">para {to}</p>
        </div>
        <p className="text-[11px] text-muted-foreground">{date}</p>
      </div>
      {body.html ? (
        <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(body.html) }} />
      ) : (
        <pre className="text-sm whitespace-pre-wrap font-sans">{body.text}</pre>
      )}
      {body.attachments.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {body.attachments.map((a) => (
            <span key={a.attachmentId} className="text-[11px] px-2 py-1 rounded bg-muted text-muted-foreground">
              📎 {a.filename} {a.size ? `· ${(a.size / 1024).toFixed(0)} KB` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Minimal sanitizer — strips <script>, event handlers, and javascript: URLs.
function sanitizeHtml(dirty: string): string {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(dirty, "text/html");
  doc.querySelectorAll("script, style, meta, link, iframe, object, embed").forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML;
}

function ReplyDialog({ latest, onClose, onSent }: { latest: GmailMessage; onClose: () => void; onSent: () => void }) {
  const originalFrom = parseAddress(getHeader(latest, "From"));
  const originalSubject = getHeader(latest, "Subject");
  const originalMsgId = getHeader(latest, "Message-ID") || getHeader(latest, "Message-Id");
  const originalRefs = getHeader(latest, "References");
  const [to, setTo] = useState(originalFrom.email);
  const [subject, setSubject] = useState(originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!to.trim() || !body.trim()) { toast.error("Preencha destinatário e corpo."); return; }
    setSending(true);
    try {
      const references = [originalRefs, originalMsgId].filter(Boolean).join(" ");
      const rfc = buildReplyRfc2822({
        to, subject, bodyText: body,
        inReplyTo: originalMsgId || undefined,
        references: references || undefined,
      });
      await sendRawEmail(rfc);
      toast.success("Resposta enviada.");
      onSent();
    } catch (e) {
      toast.error("Falha ao enviar: " + (e as Error).message);
    } finally { setSending(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Responder</DialogTitle>
          <DialogDescription>Sua resposta será enviada da sua conta Gmail conectada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Para</label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Assunto</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Mensagem</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkDialog({ latest, onClose }: { latest: GmailMessage; onClose: () => void }) {
  const [mode, setMode] = useState<"new_task" | "new_note" | "existing_task" | "existing_note">("new_task");
  const [tasks, setTasks] = useState<Array<{ id: string; title: string }>>([]);
  const [notes, setNotes] = useState<Array<{ id: string; title: string }>>([]);
  const [existingId, setExistingId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const subject = getHeader(latest, "Subject");
  const from = parseAddress(getHeader(latest, "From"));
  const body = useMemo(() => extractBody(latest), [latest]);

  useEffect(() => {
    (async () => {
      try {
        const [t, n] = await Promise.all([fetchTasks(), fetchNotes()]);
        setTasks((t as Array<{ id: string; title: string }>).slice(0, 200));
        setNotes((n as Array<{ id: string; title: string }>).slice(0, 200));
      } catch { /* ignore */ }
    })();
  }, []);

  const contextBlock = `\n\n---\n📧 E-mail: ${subject}\nDe: ${from.name || ""} <${from.email}>\n${body.text.slice(0, 800)}`.trim();

  const save = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado.");
      let taskId: string | null = null;
      let noteId: string | null = null;
      if (mode === "new_task") {
        const t = await createTask({ title: subject || `E-mail de ${from.email}`, description: contextBlock, status: "todo" } as never);
        taskId = t.id;
      } else if (mode === "new_note") {
        const n = await createNote({ title: subject || `E-mail de ${from.email}`, content: `<p>De: ${from.email}</p><pre>${(body.text || "").replace(/</g, "&lt;")}</pre>` } as never);
        noteId = n.id;
      } else if (mode === "existing_task") {
        if (!existingId) throw new Error("Escolha uma task.");
        taskId = existingId;
      } else if (mode === "existing_note") {
        if (!existingId) throw new Error("Escolha uma nota.");
        noteId = existingId;
      }

      const { error } = await supabase.from("email_task_links").insert({
        user_id: user.id,
        message_id: latest.id,
        thread_id: latest.threadId,
        subject,
        from_address: from.email,
        snippet: latest.snippet ?? null,
        task_id: taskId,
        note_id: noteId,
      });
      if (error) throw error;
      toast.success("E-mail vinculado.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular e-mail</DialogTitle>
          <DialogDescription>Crie uma nova task/nota ou vincule este e-mail a uma existente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Ação</label>
            <Select value={mode} onValueChange={(v) => { setMode(v as typeof mode); setExistingId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new_task">Criar nova task</SelectItem>
                <SelectItem value="new_note">Criar nova nota</SelectItem>
                <SelectItem value="existing_task">Vincular a task existente</SelectItem>
                <SelectItem value="existing_note">Vincular a nota existente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(mode === "existing_task" || mode === "existing_note") && (
            <div>
              <label className="text-xs text-muted-foreground">{mode === "existing_task" ? "Task" : "Nota"}</label>
              <Select value={existingId} onValueChange={setExistingId}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {(mode === "existing_task" ? tasks : notes).map((it) => (
                    <SelectItem key={it.id} value={it.id}>{it.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            {mode.startsWith("new") ? "O conteúdo do e-mail será copiado no corpo do item criado." : "Um vínculo será criado sem alterar o item existente."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
