import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Loader2, ExternalLink, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUpdateEntry, type StudyTopic, type StudyEntry } from "@/hooks/useStudies";
import { ensureHtml, htmlToPlainText, parseRepositorySources } from "@/lib/studyRepository";

interface Source { title: string; url: string; snippet?: string }
interface QA { q: string; a: string; sources?: Source[] }

interface Props { topic: StudyTopic; entry: StudyEntry; mode?: "qa" | "enrich" }

export function EntryAIAssist({ topic, entry, mode = "qa" }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QA[]>([]);
  const [suggestion, setSuggestion] = useState<QA | null>(null);
  const updateEntry = useUpdateEntry();

  const ask = async () => {
    const question = q.trim();
    if (!question || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("study-research", {
        body: {
          question: `Sobre o registro "${entry.title}" (${entry.entry_date}): ${htmlToPlainText(ensureHtml(entry.summary))}\n\nPergunta: ${question}`,
          topicTitle: topic.title,
          topicDescription: topic.description,
          entries: [{ entry_date: entry.entry_date, title: entry.title, summary: htmlToPlainText(ensureHtml(entry.summary)) }],
          history: [],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setHistory((h) => [...h, { q: question, a: data.answer, sources: data.sources ?? [] }]);
      setQ("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  const enrich = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const repositorySources = parseRepositorySources(entry)
        .filter((source) => source.title || source.url || source.text)
        .map((source, index) => [
          `Fonte ${index + 1}: ${source.title || "Sem título"}`,
          source.url ? `URL: ${source.url}` : "",
          source.text ? `Texto: ${source.text}` : "",
        ].filter(Boolean).join("\n"))
        .join("\n\n");
      const source = repositorySources || entry.source_url || entry.content || "Fonte não informada";
      const { data, error } = await supabase.functions.invoke("study-research", {
        body: {
          question: [
            "Reescreva e enriqueça o resumo abaixo, preservando a perspectiva pessoal do autor.",
            "Explique por que o conteúdo é relevante, suas implicações, possíveis usos e principais takeaways.",
            "Responda com texto claro, curto e estruturado. Não inclua lista de fontes.",
            `Título: ${entry.title}`,
            `Fonte: ${source}`,
            `Resumo atual: ${htmlToPlainText(ensureHtml(entry.summary))}`,
          ].join("\n\n"),
          topicTitle: topic.title,
          topicDescription: topic.description,
          entries: [{ entry_date: entry.entry_date, title: entry.title, summary: htmlToPlainText(ensureHtml(entry.summary)) }],
          history: [],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSuggestion({ q: "Resumo enriquecido", a: data.answer, sources: data.sources ?? [] });
      setOpen(true);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao enriquecer resumo");
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = async () => {
    if (!suggestion?.a) return;
    try {
      await updateEntry.mutateAsync({ id: entry.id, summary: ensureHtml(suggestion.a.trim()) });
      toast.success("Resumo atualizado");
      setSuggestion(null);
      setOpen(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao aplicar resumo");
    }
  };

  if (!open) {
    if (mode === "enrich") {
      return (
        <ButtonLike onClick={enrich} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {loading ? "Enriquecendo..." : "Enriquecer com IA"}
        </ButtonLike>
      );
    }
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

  if (mode === "enrich" && suggestion) {
    return (
      <div className="w-full rounded-lg border border-border bg-muted/30 p-3 space-y-3 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium"><Sparkles className="h-3.5 w-3.5" /> Sugestão da IA</span>
          <button onClick={() => { setSuggestion(null); setOpen(false); }} className="text-muted-foreground hover:text-foreground" title="Fechar"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"><ReactMarkdown>{suggestion.a}</ReactMarkdown></div>
        <div className="flex justify-end gap-2">
          <button onClick={() => { setSuggestion(null); setOpen(false); }} className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">Descartar</button>
          <button onClick={applySuggestion} disabled={updateEntry.isPending} className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
            {updateEntry.isPending ? "Aplicando..." : "Usar este resumo"}
          </button>
        </div>
      </div>
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

function ButtonLike({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
      {children}
    </button>
  );
}
