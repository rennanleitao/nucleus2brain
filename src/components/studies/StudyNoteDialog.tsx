import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { type StudyEntry, useCreateEntry, useUpdateEntry } from "@/hooks/useStudies";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  note?: StudyEntry | null;
}

export function StudyNoteDialog({ open, onOpenChange, topicId, note }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("<p></p>");
  const [tags, setTags] = useState("");
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? "");
    setContent(note?.content || "<p></p>");
    setTags((note?.tags ?? []).join(", "));
  }, [note, open]);

  const plainText = useMemo(() => htmlToPlainText(content), [content]);
  const canSave = Boolean(plainText);
  const saving = createEntry.isPending || updateEntry.isPending;

  const save = async () => {
    if (!canSave || saving) return;
    const normalizedTitle = title.trim() || "Nota sem título";
    const payload: Partial<StudyEntry> & { topic_id: string; title: string; summary: string } = {
      topic_id: topicId,
      kind: "note",
      title: normalizedTitle,
      summary: plainText.slice(0, 240),
      content,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      entry_date: null,
      source_url: null,
      category: null,
      highlight: null,
      notes: null,
    };

    try {
      if (note) {
        await updateEntry.mutateAsync({ id: note.id, ...payload });
        toast.success("Anotação atualizada");
      } else {
        await createEntry.mutateAsync(payload);
        toast.success("Anotação criada");
      }
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar anotação");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{note ? "Editar anotação" : "Nova anotação"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Título <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Dê um nome para encontrar esta nota depois" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Conteúdo *</Label>
            <RichTextEditor content={content} onChange={setContent} placeholder="Escreva ideias, conclusões, perguntas e conexões..." />
          </div>
          <div className="space-y-1.5">
            <Label>Tags <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="insight, decisão, pergunta" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!canSave || saving}>{saving ? "Salvando..." : "Salvar anotação"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function htmlToPlainText(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  return (container.textContent || "").replace(/\s+/g, " ").trim();
}
