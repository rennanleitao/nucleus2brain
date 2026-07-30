import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface AskableNote {
  id: string;
  title: string;
  content?: string | null;
}

interface AskNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: AskableNote[];
  scopeLabel?: string;
  onOpenNote?: (noteId: string) => void;
}

const SUGGESTIONS = [
  "Em qual nota falei sobre alocação de recursos?",
  "Quais decisões ficaram pendentes?",
  "Quem participou das últimas reuniões?",
];

export function AskNotesDialog({ open, onOpenChange, notes, scopeLabel, onOpenNote }: AskNotesDialogProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    if (notes.length === 0) {
      toast.error("Nenhuma nota disponível para consultar.");
      return;
    }
    setLoading(true);
    setAnswer(null);
    try {
      const { data, error } = await supabase.functions.invoke("notes-ask", {
        body: {
          question: trimmed,
          scopeLabel,
          notes: notes.map((n) => ({ id: n.id, title: n.title, content: n.content ?? "" })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnswer(data?.answer ?? "");
    } catch (e) {
      toast.error(await getEdgeFunctionErrorMessage(e, "Não consegui consultar suas notas."));
    } finally {
      setLoading(false);
    }
  };

  // Titles referenced in the answer become clickable shortcuts to the note.
  const referenced = answer
    ? notes.filter((n) => n.title && answer.toLowerCase().includes(n.title.toLowerCase()))
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">Perguntar às notas</DialogTitle>
          <DialogDescription className="text-xs">
            {scopeLabel ? `Buscando em ${scopeLabel} · ` : ""}
            {notes.length} nota{notes.length === 1 ? "" : "s"} no contexto.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
          className="flex items-center gap-2"
        >
          <Input
            autoFocus
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex: em qual nota falei sobre alocação de recursos?"
            className="text-sm"
          />
          <Button type="submit" size="sm" disabled={loading || !question.trim()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </form>

        {!answer && !loading && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuestion(s);
                  void ask(s);
                }}
                className="text-[11px] rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {loading && <p className="text-xs text-muted-foreground">Lendo suas notas…</p>}

        {answer && (
          <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="prose prose-sm max-w-none text-[13px] leading-relaxed">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
            {referenced.length > 0 && onOpenNote && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
                {referenced.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      onOpenNote(n.id);
                      onOpenChange(false);
                    }}
                    className="text-[11px] rounded-md border border-border bg-background px-2 py-1 hover:bg-muted transition-colors"
                  >
                    Abrir “{n.title}”
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
