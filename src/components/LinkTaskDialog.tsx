import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Link2, ChevronDown, ChevronRight, ArrowRightLeft } from "lucide-react";
import { fetchTasks, createSubtask, createTaskLink } from "@/lib/api";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface LinkTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTaskId: string;
  currentTaskTitle: string;
  spaces: { id: string; name: string }[];
  onLinked: () => void;
}

export function LinkTaskDialog({ open, onOpenChange, currentTaskId, currentTaskTitle, spaces, onLinked }: LinkTaskDialogProps) {
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [linkMode, setLinkMode] = useState<"link" | "subtask">("link");
  const [loading, setLoading] = useState(false);
  const [collapsedSpaces, setCollapsedSpaces] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchTasks().then(tasks => {
        setAllTasks(tasks.filter((t: any) => t.id !== currentTaskId && t.status !== "completed" && t.status !== "cancelled"));
      }).catch(() => {});
      setSearch("");
      setSelectedTask(null);
      setLinkMode("link");
      setCollapsedSpaces(new Set());
    }
  }, [open, currentTaskId]);

  const filtered = useMemo(() => {
    if (!search) return allTasks;
    const q = search.toLowerCase();
    return allTasks.filter((t: any) => t.title.toLowerCase().includes(q));
  }, [allTasks, search]);

  const groupedBySpace = useMemo(() => {
    const groups: Record<string, { spaceName: string; tasks: any[] }> = {};
    const noSpace: any[] = [];

    filtered.forEach((t: any) => {
      const spaceId = t.space_id;
      if (!spaceId) {
        noSpace.push(t);
      } else {
        if (!groups[spaceId]) {
          const spaceName = t.spaces?.name || spaces.find(s => s.id === spaceId)?.name || "Space";
          groups[spaceId] = { spaceName, tasks: [] };
        }
        groups[spaceId].tasks.push(t);
      }
    });

    const sorted = Object.entries(groups).sort((a, b) => a[1].spaceName.localeCompare(b[1].spaceName));
    return { sorted, noSpace };
  }, [filtered, spaces]);

  const toggleSpace = (spaceId: string) => {
    setCollapsedSpaces(prev => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!selectedTask) return;
    setLoading(true);
    try {
      if (linkMode === "subtask") {
        await createSubtask({
          task_id: currentTaskId,
          title: selectedTask.title,
        });
        toast.success("Task transformada em subtask!");
      } else {
        await createTaskLink(currentTaskId, selectedTask.id);
        toast.success("Tasks vinculadas!");
      }
      onOpenChange(false);
      onLinked();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const priorityColor = (p: string) => {
    if (p === "high") return "text-destructive";
    if (p === "low") return "text-muted-foreground";
    return "text-foreground";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Vincular Task
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 px-1 py-1.5 border border-border rounded-lg bg-background">
          <Search className="h-3.5 w-3.5 text-muted-foreground ml-2 shrink-0" />
          <input
            type="text"
            placeholder="Buscar tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1">
          {groupedBySpace.sorted.map(([spaceId, group]) => {
            const isCollapsed = collapsedSpaces.has(spaceId);
            return (
              <div key={spaceId}>
                <button
                  type="button"
                  onClick={() => toggleSpace(spaceId)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span className="flex items-center justify-center h-4 w-4 rounded bg-muted text-[9px] font-semibold uppercase shrink-0">
                    {group.spaceName.charAt(0)}
                  </span>
                  {group.spaceName}
                  <span className="ml-auto text-[10px] text-muted-foreground">{group.tasks.length}</span>
                </button>
                {!isCollapsed && (
                  <div className="ml-4 space-y-0.5">
                    {group.tasks.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTask(t)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors text-left ${
                          selectedTask?.id === t.id ? "bg-accent ring-1 ring-primary/30" : "hover:bg-accent/50"
                        }`}
                      >
                        <span className={`flex-1 truncate ${priorityColor(t.priority)}`}>{t.title}</span>
                        {t.due_date && <span className="text-[10px] text-muted-foreground shrink-0">{t.due_date}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {groupedBySpace.noSpace.length > 0 && (
            <div>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Sem Space</div>
              <div className="ml-4 space-y-0.5">
                {groupedBySpace.noSpace.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTask(t)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors text-left ${
                      selectedTask?.id === t.id ? "bg-accent ring-1 ring-primary/30" : "hover:bg-accent/50"
                    }`}
                  >
                    <span className={`flex-1 truncate ${priorityColor(t.priority)}`}>{t.title}</span>
                    {t.due_date && <span className="text-[10px] text-muted-foreground shrink-0">{t.due_date}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">Nenhuma task encontrada</p>
          )}
        </div>

        {selectedTask && (
          <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
            <div className="flex items-center gap-2 text-xs">
              <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate font-medium">{currentTaskTitle}</span>
              <span className="text-muted-foreground">→</span>
              <span className="truncate font-medium">{selectedTask.title}</span>
            </div>

            <RadioGroup value={linkMode} onValueChange={(v) => setLinkMode(v as "link" | "subtask")} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="link" id="link-mode" />
                <Label htmlFor="link-mode" className="text-xs cursor-pointer">
                  Apenas vincular (relação entre tasks)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="subtask" id="subtask-mode" />
                <Label htmlFor="subtask-mode" className="text-xs cursor-pointer">
                  Transformar "{selectedTask.title}" em subtask
                </Label>
              </div>
            </RadioGroup>

            <Button onClick={handleConfirm} disabled={loading} size="sm" className="w-full gradient-primary text-primary-foreground border-0">
              {loading ? "Vinculando..." : linkMode === "subtask" ? "Criar como Subtask" : "Vincular Tasks"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
