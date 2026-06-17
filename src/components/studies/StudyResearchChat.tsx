import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, Loader2, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { StudyTopic, StudyEntry } from "@/hooks/useStudies";

interface Props {
  topic: StudyTopic;
  entries: StudyEntry[];
}

interface Source { title: string; url: string; snippet?: string }
interface Msg { role: "user" | "assistant"; content: string; sources?: Source[] }

const SUGGESTIONS = [
  "Qual o dado mais recente sobre isso?",
  "Resuma o que mudou no último mês",
  "Cite fontes oficiais sobre o tema",
];

export function StudyResearchChat({ topic, entries }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { setMessages([]); }, [topic.id]);

  const send = async (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setMessages((p) => [...p, { role: "user", content: question }]);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("study-research", {
        body: {
          question,
          topicTitle: topic.title,
          topicDescription: topic.description,
          entries: entries.map((e) => ({ entry_date: e.entry_date, title: e.title, summary: e.summary })),
          history: messages.slice(-6),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages((p) => [...p, { role: "assistant", content: data.answer, sources: data.sources ?? [] }]);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao pesquisar");
      setMessages((p) => p.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Pesquisar com IA
        </h2>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="h-7 text-[11px] text-muted-foreground">
            <Trash2 className="h-3 w-3 mr-1" /> Limpar
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {messages.length === 0 ? (
          <div className="p-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              Faça perguntas complementares sobre <span className="font-medium text-foreground">{topic.title}</span> — dados atuais, contexto, fontes.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background hover:border-foreground/30 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-h-[480px] overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div className={m.role === "user"
                  ? "max-w-[85%] rounded-xl bg-muted px-3.5 py-2 text-sm"
                  : "w-full space-y-2"}>
                  {m.role === "assistant" ? (
                    <>
                      <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-foreground prose-a:underline prose-a:underline-offset-2 prose-p:leading-relaxed">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                      {m.sources && m.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {m.sources.map((s, j) => (
                            <a key={j} href={s.url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-border bg-background hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors max-w-[280px]">
                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{s.title}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pesquisando...
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        <div className="border-t border-border p-2 flex gap-2 bg-background/50">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Pergunte algo sobre este tema..."
            disabled={loading}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-9"
          />
          <Button size="sm" onClick={() => send()} disabled={loading || !input.trim()} className="h-9">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </section>
  );
}
