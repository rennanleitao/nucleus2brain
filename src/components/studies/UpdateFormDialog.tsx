import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateUpdate,
  useUpdateUpdate,
  UPDATE_TYPE_LABELS,
  type StudyUpdate,
  type StudyUpdateType,
} from "@/hooks/useStudies";
import { getBrtToday } from "@/lib/timezone";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topicId: string;
  update?: StudyUpdate | null;
}

export function UpdateFormDialog({ open, onOpenChange, topicId, update }: Props) {
  const [type, setType] = useState<StudyUpdateType>("noticia");
  const [date, setDate] = useState(getBrtToday());
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [whyItMatters, setWhyItMatters] = useState("");
  const [whatChanged, setWhatChanged] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState("");
  const create = useCreateUpdate();
  const updateMut = useUpdateUpdate();

  useEffect(() => {
    if (!open) return;
    setType((update?.type as StudyUpdateType) ?? "noticia");
    setDate(update?.date ?? getBrtToday());
    setTitle(update?.title ?? "");
    setSummary(update?.summary ?? "");
    setWhyItMatters(update?.why_it_matters ?? "");
    setWhatChanged(update?.what_changed ?? "");
    setSourceName(update?.source_name ?? "");
    setSourceUrl(update?.source_url ?? "");
    setTags((update?.tags ?? []).join(", "));
  }, [open, update]);

  const valid = title.trim() && summary.trim() && date;

  const submit = async () => {
    if (!valid) return;
    const payload = {
      topic_id: topicId,
      type,
      date,
      title: title.trim(),
      summary: summary.trim(),
      why_it_matters: whyItMatters.trim() || null,
      what_changed: whatChanged.trim() || null,
      source_name: sourceName.trim() || null,
      source_url: sourceUrl.trim() || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (update) {
        await updateMut.mutateAsync({ id: update.id, ...payload });
        toast.success("Atualização salva");
      } else {
        await create.mutateAsync(payload);
        toast.success("Atualização adicionada");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{update ? "Editar atualização" : "Nova atualização"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as StudyUpdateType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(UPDATE_TYPE_LABELS) as StudyUpdateType[]).map((t) => (
                    <SelectItem key={t} value={t}>{UPDATE_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Resumo</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Por que importa</Label>
            <Textarea value={whyItMatters} onChange={(e) => setWhyItMatters(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>O que mudou (opcional)</Label>
            <Textarea value={whatChanged} onChange={(e) => setWhatChanged(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fonte (opcional)</Label>
              <Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Ex.: Bloomberg" />
            </div>
            <div className="space-y-1.5">
              <Label>URL (opcional)</Label>
              <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="separadas por vírgula" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!valid}>{update ? "Salvar" : "Adicionar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
