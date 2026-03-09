import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Tag, X } from "lucide-react";
import { createTask, createSpace, fetchAllTags } from "@/lib/api";
import { SpaceIconPicker } from "@/components/SpaceIconPicker";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface CreateTaskDialogProps {
  spaces: { id: string; name: string }[];
  onCreated: () => void;
  defaultSpaceId?: string;
  trigger?: React.ReactNode;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function CreateTaskDialog({ spaces, onCreated, defaultSpaceId, trigger, externalOpen, onExternalOpenChange }: CreateTaskDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onExternalOpenChange?.(v);
    else setInternalOpen(v);
  };
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [spaceId, setSpaceId] = useState<string>(defaultSpaceId || (spaces.length === 1 ? spaces[0].id : ""));
  const [dueDate, setDueDate] = useState("");
  const [tag, setTag] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAllTags().then(setAllTags).catch(() => {});
    }
  }, [open]);

  // Inline space creation
  const [showNewSpace, setShowNewSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceIcon, setNewSpaceIcon] = useState("folder");
  const [creatingSpace, setCreatingSpace] = useState(false);

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return;
    setCreatingSpace(true);
    try {
      const space = await createSpace({ name: newSpaceName.trim(), icon: newSpaceIcon });
      setSpaceId(space.id);
      setNewSpaceName("");
      setNewSpaceIcon("folder");
      setShowNewSpace(false);
      toast.success("Space criado!");
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingSpace(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    const autoStatus = dueDate ? "in_progress" : "todo";
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status: autoStatus,
        space_id: spaceId || null,
        due_date: dueDate || null,
        tag: tag || null,
      } as any);
      toast.success("Task criada!");
      setTitle(""); setDescription(""); setPriority("medium"); setSpaceId(defaultSpaceId || (spaces.length === 1 ? spaces[0].id : "")); setDueDate(""); setTag(""); setTagInput("");
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTags = allTags.filter(t => !tagInput || t.toLowerCase().includes(tagInput.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" className="gradient-primary text-primary-foreground border-0">
            <Plus className="h-4 w-4 mr-1" /> New Task
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Criar Task</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="Título da task" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" required />
          <textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary h-20 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prioridade</label>
              <select value={priority} onChange={e => setPriority(e.target.value as any)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data limite</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              <div className="flex gap-1 mt-1">
                <button type="button" onClick={() => setDueDate(new Date().toISOString().split("T")[0])}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${dueDate === new Date().toISOString().split("T")[0] ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"}`}>
                  Hoje
                </button>
                <button type="button" onClick={() => setDueDate(new Date(Date.now() + 86400000).toISOString().split("T")[0])}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${dueDate === new Date(Date.now() + 86400000).toISOString().split("T")[0] ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"}`}>
                  Amanhã
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {dueDate ? "Status: Em Progresso" : "Status: A Fazer"}
              </p>
            </div>
          </div>

          {/* Tag selector */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Tag className="h-3 w-3" /> Tag (opcional)
            </label>
            {tag ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">#{tag}</Badge>
                <button type="button" onClick={() => setTag("")} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar ou criar tag..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onFocus={() => setShowTagPicker(true)}
                  onBlur={() => setTimeout(() => setShowTagPicker(false), 150)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      setTag(tagInput.trim().replace(/^#/, ""));
                      setTagInput("");
                      setShowTagPicker(false);
                    }
                  }}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                />
                {showTagPicker && filteredTags.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                    {filteredTags.map(t => (
                      <button key={t} type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setTag(t); setTagInput(""); setShowTagPicker(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors">
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Space selector with inline creation */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Space</label>
            <div className="flex gap-2">
              <select value={spaceId} onChange={e => setSpaceId(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="">Sem space</option>
                {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Button type="button" variant="outline" size="sm" className="shrink-0 h-auto"
                onClick={() => setShowNewSpace(!showNewSpace)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {showNewSpace && (
              <div className="mt-2 border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                <p className="text-xs font-medium text-foreground">Novo Space</p>
                <SpaceIconPicker value={newSpaceIcon} onChange={setNewSpaceIcon} />
                <input type="text" placeholder="Nome do space" value={newSpaceName} onChange={e => setNewSpaceName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewSpace(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="button" size="sm" disabled={creatingSpace || !newSpaceName.trim()} onClick={handleCreateSpace}
                    className="flex-1 gradient-primary text-primary-foreground border-0">
                    {creatingSpace ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground border-0">
            {loading ? "Criando..." : "Criar Task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}