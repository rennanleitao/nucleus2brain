import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Loader2, ExternalLink, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { StudyTopic, StudyEntry } from "@/hooks/useStudies";

interface Source { title: string; url: string; snippet?: string }
interface QA { q: string; a: string; sources?: Source[] }

interface Props { topic: StudyTopic; entry: StudyEntry }

export function EntryAIAssist({ topic, entry }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QA[]>([]);

  const ask = async () => {
    const question = q.trim();
    if (!question || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("study-research", {
        body: {
          question: `Sobre o registro "${entry.title}" (${entry.entry_date}): ${entry.summary}\n\nPergunta: ${question}`,
          topicTitle: topic.title,
          topicDescription: topic.description,
          entries: [{ entry_date: entry.entry_date, title: entry.title, summary: entry.summary }],
          history: [],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setHistory((h) => [...h, { q: question, a: data.answer, sources: data.sources ?? [] }]);
      setQ("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
        title="Complementar com IA"
      >
        <Sparkles className="h-3 w-3" /> Complementar com IA
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2.5 space-y-2 animate-fade-in">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); ask(); }
            if (e.key === "Escape" && !q && history.length === 0) setOpen(false);
          }}
          disabled={loading}
          placeholder="Perguntar à IA sobre este item..."
          className="flex-1 bg-transparent border-0 outline-none text-xs placeholder:text-muted-foreground/70"
        />
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        <button onClick={() => { setOpen(false); setHistory([]); setQ(""); }} className="text-muted-foreground hover:text-foreground" title="Fechar">
          <X className="h-3 w-3" />
        </button>
      </div>

      {history.map((item, i) => (
        <div key={i} className="space-y-1.5 pl-5 border-l border-border/60">
          <div className="text-[11px] text-muted-foreground italic">{item.q}</div>
          <div className="prose prose-sm max-w-none text-xs prose-p:leading-relaxed prose-p:my-1 prose-a:text-foreground prose-a:underline prose-a:underline-offset-2">
            <ReactMarkdown>{item.a}</ReactMarkdown>
          </div>
          {item.sources && item.sources.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {item.sources.map((s, j) => (
                <a key={j} href={s.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-border bg-background hover:border-foreground/30 text-muted-foreground hover:text-foreground max-w-[220px]">
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{s.title}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
