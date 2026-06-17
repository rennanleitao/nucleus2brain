import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTopic, useUpdateTopic, useStudyAreas, type StudyTopic } from "@/hooks/useStudies";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topic?: StudyTopic | null;
  defaultAreaId?: string | null;
}

export function TopicFormDialog({ open, onOpenChange, topic, defaultAreaId }: Props) {
  const { data: areas = [] } = useStudyAreas();
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const create = useCreateTopic();
  const update = useUpdateTopic();

  useEffect(() => {
    if (!open) return;
    setTitle(topic?.title ?? "");
    setAreaId(topic?.area_id ?? defaultAreaId ?? areas[0]?.id ?? "");
    setDescription(topic?.description ?? "");
    setTags((topic?.tags ?? []).join(", "));
  }, [open, topic, defaultAreaId, areas]);

  const submit = async () => {
    if (!title.trim() || !areaId) return;
    const tagArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      const payload = {
        title: title.trim(),
        area_id: areaId,
        description: description.trim() || null,
        tags: tagArr,
      };
      if (topic) {
        await update.mutateAsync({ id: topic.id, ...payload });
        toast.success("Tema atualizado");
      } else {
        await create.mutateAsync(payload);
        toast.success("Tema criado");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar tema");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{topic ? "Editar tema" : "Novo tema"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Mercado de RPA" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Área *</Label>
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="rpa, automação, ia" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!title.trim() || !areaId}>{topic ? "Salvar" : "Criar tema"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
