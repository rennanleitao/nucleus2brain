import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateEntry, useUpdateEntry, type StudyEntry } from "@/hooks/useStudies";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topicId: string;
  entry?: StudyEntry | null;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function EntryFormDialog({ open, onOpenChange, topicId, entry }: Props) {
  const [entryDate, setEntryDate] = useState(todayISO());
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [highlight, setHighlight] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const create = useCreateEntry();
  const update = useUpdateEntry();

  useEffect(() => {
    if (!open) return;
    setEntryDate(entry?.entry_date ?? todayISO());
    setTitle(entry?.title ?? "");
    setSummary(entry?.summary ?? "");
    setSourceUrl(entry?.source_url ?? "");
    setHighlight(entry?.highlight ?? "");
    setNotes(entry?.notes ?? "");
    setTags((entry?.tags ?? []).join(", "));
  }, [open, entry]);

  const submit = async () => {
    if (!title.trim() || !summary.trim() || !entryDate) return;
    const tagArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      topic_id: topicId,
      entry_date: entryDate,
      title: title.trim(),
      summary: summary.trim(),
      source_url: sourceUrl.trim() || null,
      highlight: highlight.trim() || null,
      notes: notes.trim() || null,
      tags: tagArr,
    };
    try {
      if (entry) {
        await update.mutateAsync({ id: entry.id, ...payload });
        toast.success("Registro atualizado");
      } else {
        await create.mutateAsync(payload);
        toast.success("Registro adicionado");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar registro");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? "Editar registro" : "Adicionar registro"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumo curto" autoFocus />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Resumo *</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="Sobre o que é este registro" />
          </div>
          <div className="space-y-1.5">
            <Label>Link da fonte</Label>
            <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Highlight</Label>
            <Textarea value={highlight} onChange={(e) => setHighlight(e.target.value)} rows={2} placeholder="Trecho ou dado mais importante" />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Sua interpretação" />
          </div>
          <div className="space-y-1.5">
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="rpa, ia" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!title.trim() || !summary.trim() || !entryDate}>
            {entry ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
