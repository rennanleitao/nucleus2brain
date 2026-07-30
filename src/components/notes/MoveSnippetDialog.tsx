import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, FilePlus, Loader2 } from "lucide-react";
import { createNote, updateNote, fetchNotes, fetchNotesBySpace } from "@/lib/api";
import { toast } from "sonner";

interface MoveSnippetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** HTML of the selected snippet */
  html: string;
  /** Plain text preview of the snippet */
  text: string;
  currentNoteId: string | null;
  spaceId?: string | null;
  /** Called after the snippet was successfully stored elsewhere */
  onMoved: () => void;
}

export function MoveSnippetDialog({
  open,
  onOpenChange,
  html,
  text,
  currentNoteId,
  spaceId,
  onMoved,
}: MoveSnippetDialogProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const firstLine = text.trim().split("\n")[0] || "Nota rápida";
    setNewTitle(firstLine.length > 60 ? firstLine.slice(0, 60) + "…" : firstLine);
    (async () => {
      try {
        const n = spaceId ? await fetchNotesBySpace(spaceId) : await fetchNotes();
        setNotes(n || []);
      } catch {
        setNotes([]);
      }
    })();
  }, [open, spaceId, text]);

  const filtered = useMemo(
    () =>
      notes
        .filter((n) => n.id !== currentNoteId)
        .filter((n) => (n.title || "").toLowerCase().includes(query.toLowerCase()))
        .slice(0, 50),
    [notes, currentNoteId, query]
  );

  const handleExisting = async (note: any) => {
    setSaving(true);
    try {
      await updateNote(note.id, { content: `${note.content || ""}${html}` });
      toast.success(`Trecho movido para "${note.title}"`);
      onOpenChange(false);
      onMoved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleNew = async () => {
    setSaving(true);
    try {
      const created = await createNote({
        title: newTitle.trim() || "Nota rápida",
        content: html,
        space_id: spaceId || null,
      } as any);
      toast.success(`Nota "${created.title}" criada com o trecho`);
      onOpenChange(false);
      onMoved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="text-base">Mover trecho para outra nota</DialogTitle>
        </DialogHeader>

        <div className="px-4 pt-2">
          <div className="rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground max-h-24 overflow-y-auto whitespace-pre-wrap">
            {text}
          </div>
        </div>

        <div className="px-4 pt-3 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground">Nova nota</p>
          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título da nova nota..."
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleNew()}
            />
            <Button size="sm" className="h-8 gap-1.5" disabled={saving} onClick={handleNew}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <FilePlus className="h-3 w-3" />}
              Criar
            </Button>
          </div>
        </div>

        <div className="px-4 pt-4">
          <p className="text-[11px] font-medium text-muted-foreground mb-2">Ou adicionar a uma nota existente</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar nota..."
              className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma nota encontrada</p>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                disabled={saving}
                onClick={() => handleExisting(n)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{n.title}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
