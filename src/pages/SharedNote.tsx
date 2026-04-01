import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Loader2, Wand2, MessageSquare, User, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { SharedNoteEditor } from "@/components/SharedNoteEditor";

interface GuestInfo {
  id: string;
  guest_name: string;
  guest_token: string;
}

interface Comment {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function SharedNote() {
  const { token } = useParams<{ token: string }>();
  const [note, setNote] = useState<any>(null);
  const [shareConfig, setShareConfig] = useState<any>(null);
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Guest
  const [guest, setGuest] = useState<GuestInfo | null>(() => {
    const stored = localStorage.getItem("note-guest");
    return stored ? JSON.parse(stored) : null;
  });
  const [guestNameInput, setGuestNameInput] = useState("");
  const [showGuestForm, setShowGuestForm] = useState(false);

  // Editor
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [showComments, setShowComments] = useState(false);

  // AI Chat
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const aiEndRef = useRef<HTMLDivElement>(null);

  const loadNote = useCallback(async () => {
    if (!token) return;
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("shared-note", {
        body: { action: "get_note", share_token: token },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setNote(data.note);
      setContent(data.note.content || "");
      setShareConfig(data.share);
      setOwnerName(data.owner_name);
      if (!guest) setShowGuestForm(true);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar nota");
    } finally {
      setLoading(false);
    }
  }, [token, guest]);

  const loadComments = useCallback(async () => {
    if (!token) return;
    const { data } = await supabase.functions.invoke("shared-note", {
      body: { action: "get_comments", share_token: token },
    });
    if (data?.comments) setComments(data.comments);
  }, [token]);

  useEffect(() => { loadNote(); }, [loadNote]);
  useEffect(() => { loadComments(); }, [loadComments]);
  useEffect(() => { aiEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages]);

  const handleRegisterGuest = async () => {
    if (!guestNameInput.trim()) return;
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("shared-note", {
        body: { action: "register_guest", guest_name: guestNameInput.trim() },
      });
      if (fnErr) throw fnErr;
      const g = data.guest;
      setGuest(g);
      localStorage.setItem("note-guest", JSON.stringify(g));
      setShowGuestForm(false);
      toast.success(`Bem-vindo, ${g.guest_name}!`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Autosave with debounce
  useEffect(() => {
    if (!dirty || !shareConfig?.allow_edit || !guest) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => handleSave(), 3000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [content, dirty]);

  const handleSave = async () => {
    if (!token || !guest || saving) return;
    setSaving(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("shared-note", {
        body: {
          action: "update_note",
          share_token: token,
          guest_token: guest.guest_token,
          content,
          editor_name: guest.guest_name,
          change_summary: "Conteúdo editado",
        },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setDirty(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditorChange = useCallback((html: string) => {
    setContent(html);
    setDirty(true);
  }, []);

  const handleComment = async () => {
    if (!commentInput.trim() || !guest || !token) return;
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("shared-note", {
        body: {
          action: "add_comment",
          share_token: token,
          guest_token: guest.guest_token,
          comment: commentInput.trim(),
          editor_name: guest.guest_name,
        },
      });
      if (fnErr) throw fnErr;
      if (data?.comment) setComments(prev => [...prev, data.comment]);
      setCommentInput("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAiSend = async () => {
    const question = aiInput.trim();
    if (!question || aiLoading || !shareConfig?.allow_ai) return;
    setAiInput("");
    setShowAi(true);
    const userMsg: ChatMessage = { role: "user", content: question };
    setAiMessages(prev => [...prev, userMsg]);
    setAiLoading(true);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("note-ai-chat", {
        body: {
          question,
          noteTitle: note?.title || "",
          noteContent: content,
          history: aiMessages.slice(-6),
        },
      });
      if (fnErr) throw fnErr;
      setAiMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", content: "Erro ao consultar IA." }]);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (showGuestForm && !guest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Identificação</h2>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium">{ownerName}</span> compartilhou uma nota com você.
              <br />Informe seu nome para continuar.
            </p>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={guestNameInput}
              onChange={e => setGuestNameInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRegisterGuest()}
              placeholder="Seu nome..."
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary"
              autoFocus
            />
            <Button className="w-full" onClick={handleRegisterGuest} disabled={!guestNameInput.trim()}>
              Continuar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <h1 className="text-sm font-semibold truncate">{note?.title}</h1>
          {note?.tags?.length > 0 && (
            <div className="hidden sm:flex gap-1">
              {note.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">#{tag}</Badge>
              ))}
            </div>
          )}
          {dirty && <Badge variant="secondary" className="text-[10px]">Editando...</Badge>}
          {saving && <Badge variant="outline" className="text-[10px]">Salvando...</Badge>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {shareConfig?.allow_comments && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowComments(!showComments)}>
              <MessageSquare className="h-3.5 w-3.5" />
              {comments.length > 0 && <span>{comments.length}</span>}
            </Button>
          )}
          {guest && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <User className="h-2.5 w-2.5" /> {guest.guest_name}
            </Badge>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="max-w-3xl mx-auto p-6">
              <SharedNoteEditor
                content={content}
                onChange={handleEditorChange}
                editable={!!shareConfig?.allow_edit}
              />
            </div>
          </ScrollArea>

          {/* AI Chat bar */}
          {shareConfig?.allow_ai && (
            <div className="border-t border-border bg-muted/30">
              {showAi && aiMessages.length > 0 && (
                <div className="max-h-48 overflow-y-auto px-4 pt-3 space-y-2">
                  {aiMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                      }`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-xs max-w-none dark:prose-invert [&>p]:my-1">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : msg.content}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-card border border-border rounded-lg px-3 py-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  <div ref={aiEndRef} />
                </div>
              )}
              <div className="flex items-center gap-2 px-4 py-2.5">
                <Wand2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAiSend()}
                  placeholder="Pergunte algo sobre esta nota..."
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
                  disabled={aiLoading}
                />
                {aiMessages.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setAiMessages([]); setShowAi(false); }}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={!aiInput.trim() || aiLoading} onClick={handleAiSend}>
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Comments sidebar */}
        {showComments && shareConfig?.allow_comments && (
          <div className="w-72 border-l border-border flex flex-col bg-card">
            <div className="p-3 border-b border-border">
              <h3 className="text-xs font-semibold flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Comentários
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {comments.map(c => (
                  <div key={c.id} className="p-2 rounded-lg bg-muted/50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{c.author_name}</span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "HH:mm")}</span>
                    </div>
                    <p className="text-muted-foreground">{c.content}</p>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-4">Nenhum comentário</p>
                )}
              </div>
            </ScrollArea>
            {guest && (
              <div className="p-3 border-t border-border flex gap-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleComment()}
                  placeholder="Comentar..."
                  className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!commentInput.trim()} onClick={handleComment}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
