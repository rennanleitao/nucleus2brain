import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateSpace, deleteSpace } from "@/lib/api";
import { SpaceIconPicker } from "@/components/SpaceIconPicker";
import { SpaceCategoryPicker } from "@/components/SpaceCategoryPicker";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface EditSpaceDialogProps {
  space: {
    id: string;
    name: string;
    description?: string | null;
    icon: string | null;
    category_id?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onDeleted?: () => void;
}

export function EditSpaceDialog({ space, open, onOpenChange, onUpdated, onDeleted }: EditSpaceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description || "");
  const [icon, setIcon] = useState(space.icon || "folder");
  const [categoryId, setCategoryId] = useState<string | null>(space.category_id ?? null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateSpace(space.id, {
        name: name.trim(),
        description: description.trim() || null,
        icon,
        category_id: categoryId,
      });
      toast.success("Space atualizado!");
      onOpenChange(false);
      onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este space?")) return;
    setLoading(true);
    try {
      await deleteSpace(space.id);
      toast.success("Space excluído!");
      onOpenChange(false);
      onDeleted?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar Space</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ícone</label>
            <SpaceIconPicker value={icon} onChange={setIcon} />
          </div>
          <input type="text" placeholder="Nome do space" value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" required />
          <textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary h-20 resize-none" />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
            <SpaceCategoryPicker value={categoryId} onChange={(id) => setCategoryId(id)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1 gradient-primary text-primary-foreground border-0">
              {loading ? "Salvando..." : "Salvar"}
            </Button>
            <Button type="button" variant="destructive" size="icon" onClick={handleDelete} disabled={loading}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
