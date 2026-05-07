import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchNotes, updateNote } from "@/lib/api";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Maximize2, Save } from "lucide-react";
import { toast } from "sonner";

interface NotePreviewDialogProps {
  noteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFull?: (noteId: string) => void;
}

export function NotePreviewDialog({ noteId, open, onOpenChange, onOpenFull }: NotePreviewDialogProps) {
  const [note, setNote] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !noteId) return;
    setLoading(true);
    fetchNotes()
      .then((all) => {
        const n = all.find((x: any) => x.id === noteId);
        if (n) {
          setNote(n);
          setTitle(n.title);
          setContent(n.content || "");
          setDirty(false);
        }
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [open, noteId]);

  const handleSave = async () => {
    if (!note || !title.trim()) return;
    setSaving(true);
    try {
      await updateNote(note.id, { title: title.trim(), content });
      setDirty(false);
      toast.success("Nota salva");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && dirty) handleSave(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
              className="flex-1 text-base font-semibold bg-transparent outline-none"
              placeholder="Título"
            />
            {dirty && (
              <Button size="sm" onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground border-0 text-xs">
                <Save className="h-3 w-3 mr-1" />
                {saving ? "..." : "Salvar"}
              </Button>
            )}
            {onOpenFull && noteId && (
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Abrir nota inteira"
                onClick={() => { if (dirty) handleSave(); onOpenFull(noteId); onOpenChange(false); }}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <DialogTitle className="sr-only">Pré-visualização da nota</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-muted-foreground p-4">Carregando...</p>
          ) : note ? (
            <RichTextEditor
              content={content}
              onChange={(html) => { setContent(html); setDirty(true); }}
              noteId={note.id}
              spaceId={note.space_id || null}
              className="border-0 rounded-none"
              placeholder="Comece a escrever..."
            />
          ) : (
            <p className="text-xs text-muted-foreground p-4">Nota não encontrada</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
