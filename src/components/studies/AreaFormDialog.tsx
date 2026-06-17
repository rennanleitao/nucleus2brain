import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateArea, useUpdateArea, type StudyArea } from "@/hooks/useStudies";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  area?: StudyArea | null;
}

export function AreaFormDialog({ open, onOpenChange, area }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createArea = useCreateArea();
  const updateArea = useUpdateArea();

  useEffect(() => {
    if (open) {
      setName(area?.name ?? "");
      setDescription(area?.description ?? "");
    }
  }, [open, area]);

  const submit = async () => {
    if (!name.trim()) return;
    try {
      if (area) {
        await updateArea.mutateAsync({ id: area.id, name: name.trim(), description: description.trim() || null });
        toast.success("Área atualizada");
      } else {
        await createArea.mutateAsync({ name: name.trim(), description: description.trim() || null });
        toast.success("Área criada");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar área");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{area ? "Editar área" : "Nova área de estudo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="area-name">Nome</Label>
            <Input id="area-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Análise Concorrencial" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area-desc">Descrição (opcional)</Label>
            <Textarea id="area-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!name.trim()}>{area ? "Salvar" : "Criar área"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
