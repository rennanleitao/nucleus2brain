import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpaceIcon } from "@/components/SpaceIconPicker";
import { Label } from "@/components/ui/label";

interface MoveNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "move" | "replicate";
  currentSpaceId: string | null;
  spaces: any[];
  onConfirm: (targetSpaceId: string) => void;
}

export function MoveNoteDialog({ open, onOpenChange, mode, currentSpaceId, spaces, onConfirm }: MoveNoteDialogProps) {
  const [targetSpaceId, setTargetSpaceId] = useState("");

  const availableSpaces = spaces.filter(s => s.id !== currentSpaceId);

  const handleConfirm = () => {
    if (!targetSpaceId) return;
    onConfirm(targetSpaceId);
    setTargetSpaceId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "move" ? "Mover nota para outro Space" : "Replicar nota para outro Space"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            {mode === "move"
              ? "A nota será movida para o Space selecionado e removida do atual."
              : "Uma cópia da nota será criada no Space selecionado. A nota original permanece no Space atual."}
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">Space de destino</Label>
            <Select value={targetSpaceId} onValueChange={setTargetSpaceId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um Space" />
              </SelectTrigger>
              <SelectContent>
                {availableSpaces.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <SpaceIcon iconKey={s.icon} className="h-4 w-4" />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
                {mode === "move" && (
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Sem espaço</span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleConfirm} disabled={!targetSpaceId}>
            {mode === "move" ? "Mover" : "Replicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
