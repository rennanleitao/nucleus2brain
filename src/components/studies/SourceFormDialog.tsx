import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSource, SOURCE_TYPE_LABELS, type StudySourceType } from "@/hooks/useStudies";
import { getBrtToday } from "@/lib/timezone";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topicId: string;
}

export function SourceFormDialog({ open, onOpenChange, topicId }: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [sourceType, setSourceType] = useState<StudySourceType>("noticia");
  const [capturedAt, setCapturedAt] = useState(getBrtToday());
  const [notes, setNotes] = useState("");
  const create = useCreateSource();

  useEffect(() => {
    if (open) {
      setName(""); setUrl(""); setSourceType("noticia"); setCapturedAt(getBrtToday()); setNotes("");
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim()) return;
    try {
      await create.mutateAsync({
        topic_id: topicId,
        name: name.trim(),
        url: url.trim() || null,
        source_type: sourceType,
        captured_at: capturedAt,
        notes: notes.trim() || null,
      });
      toast.success("Fonte adicionada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nova fonte</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as StudySourceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_TYPE_LABELS) as StudySourceType[]).map((t) => (
                    <SelectItem key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data de captura</Label>
              <Input type="date" value={capturedAt} onChange={(e) => setCapturedAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!name.trim()}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
