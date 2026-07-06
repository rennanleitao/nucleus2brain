import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createSpace } from "@/lib/api";
import { SpaceIconPicker } from "@/components/SpaceIconPicker";
import { SpaceCategoryPicker } from "@/components/SpaceCategoryPicker";
import { toast } from "sonner";

interface CreateSpaceDialogProps {
  onCreated: () => void;
}

export function CreateSpaceDialog({ onCreated }: CreateSpaceDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("folder");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createSpace({
        name: name.trim(),
        description: description.trim() || null,
        icon,
        category_id: categoryId,
      });
      toast.success("Space created!");
      setName(""); setDescription(""); setIcon("folder"); setCategoryId(null);
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gradient-primary text-primary-foreground border-0">
          <Plus className="h-4 w-4 mr-1" /> New Space
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create Space</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ícone</label>
            <SpaceIconPicker value={icon} onChange={setIcon} />
          </div>
          <input type="text" placeholder="Space name" value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" required />
          <textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary h-20 resize-none" />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
            <SpaceCategoryPicker value={categoryId} onChange={(id) => setCategoryId(id)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground border-0">
            {loading ? "Creating..." : "Create Space"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
