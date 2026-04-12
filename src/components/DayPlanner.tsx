import { useState, useMemo } from "react";
import { TaskCard } from "@/components/TaskCard";
import { CalendarCheck, ChevronDown, ChevronRight, ArrowRight, CalendarClock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { updateTask } from "@/lib/api";
import { toast } from "sonner";

function getBrtToday() {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return brt.toISOString().split("T")[0];
}

interface DayPlannerProps {
  tasks: any[];
  setTasks: React.Dispatch<React.SetStateAction<any[]>>;
  subtasksMap: Record<string, any[]>;
  remindersMap: Record<string, any>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSubtask: (id: string) => void;
  onAddSubtask: (taskId: string, title: string, dueDate?: string) => void;
  onDeleteSubtask: (id: string) => void;
  onPriorityChange: (id: string, priority: "low" | "medium" | "high") => void;
  onSelect: (task: any) => void;
  onReload: () => void;
}

export function DayPlanner({
  tasks, setTasks, subtasksMap, remindersMap,
  onToggle, onDelete, onToggleSubtask, onAddSubtask,
  onDeleteSubtask, onPriorityChange, onSelect, onReload,
}: DayPlannerProps) {
  const [showFuture, setShowFuture] = useState(false);
  const [futureCollapsed, setFutureCollapsed] = useState(false);

  const today = getBrtToday();

  const todayTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date <= today)
      .sort((a, b) => {
        const aOrder = a.day_order ?? 999999;
        const bOrder = b.day_order ?? 999999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.created_at.localeCompare(b.created_at);
      });

  const futureTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date > today)
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  }, [tasks, today]);

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= todayTasks.length) return;
    const reordered = [...todayTasks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Optimistic update
    const updatedTasks = tasks.map(t => {
      const idx = reordered.findIndex(r => r.id === t.id);
      if (idx !== -1) return { ...t, day_order: idx + 1 };
      return t;
    });
    setTasks(updatedTasks);

    try {
      await Promise.all(reordered.map((t, idx) => updateTask(t.id, { day_order: idx + 1 } as any)));
    } catch (err: any) {
      toast.error(err.message);
      onReload();
    }
  };

  const handleMoveToToday = async (taskId: string) => {
    try {
      await updateTask(taskId, { due_date: today } as any);
      toast.success("Task movida para hoje");
      onReload();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary" />
          <h2 className="text-h2">Planejamento do Dia</h2>
          <span className="text-micro text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
            {todayTasks.length} task{todayTasks.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Today tasks – reorderable */}
      {todayTasks.length > 0 ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="space-y-2">
            {todayTasks.map((t, idx) => (
              <div key={t.id} onClick={() => onSelect(t)} className="cursor-pointer">
                <TaskCard
                  task={t}
                  subtasks={subtasksMap[t.id] || []}
                  reminder={remindersMap[t.id] || null}
                  onToggle={() => onToggle(t.id)}
                  onDelete={() => onDelete(t.id)}
                  onToggleSubtask={onToggleSubtask}
                  onAddSubtask={onAddSubtask}
                  onDeleteSubtask={onDeleteSubtask}
                  onPriorityChange={onPriorityChange}
                  orderNumber={idx + 1}
                  onMoveUp={() => handleReorder(idx, idx - 1)}
                  onMoveDown={() => handleReorder(idx, idx + 1)}
                  isFirst={idx === 0}
                  isLast={idx === todayTasks.length - 1}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 rounded-xl border border-dashed border-border">
          <CalendarCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-small text-muted-foreground">Nenhuma task para hoje</p>
          <p className="text-micro text-muted-foreground mt-1">Agende tasks com data de hoje para planejar seu dia</p>
        </div>
      )}

      {/* Future tasks section */}
      {futureTasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-small font-medium text-muted-foreground">
                Atividades futuras ({futureTasks.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-micro text-muted-foreground">Mostrar</span>
              <Switch checked={showFuture} onCheckedChange={setShowFuture} />
            </div>
          </div>

          {showFuture && (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <button
                onClick={() => setFutureCollapsed(!futureCollapsed)}
                className="flex items-center gap-2 mb-2 text-left w-full"
              >
                {futureCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-xs font-medium text-muted-foreground">
                  {futureTasks.length} task{futureTasks.length !== 1 ? "s" : ""} futura{futureTasks.length !== 1 ? "s" : ""}
                </span>
              </button>

              {!futureCollapsed && (
                <div className="space-y-2">
                  {futureTasks.map(t => (
                    <div key={t.id} className="flex items-start gap-2">
                      <div className="flex-1 cursor-pointer" onClick={() => onSelect(t)}>
                        <TaskCard
                          task={t}
                          subtasks={subtasksMap[t.id] || []}
                          reminder={remindersMap[t.id] || null}
                          onToggle={() => onToggle(t.id)}
                          onDelete={() => onDelete(t.id)}
                          onToggleSubtask={onToggleSubtask}
                          onAddSubtask={onAddSubtask}
                          onDeleteSubtask={onDeleteSubtask}
                          onPriorityChange={onPriorityChange}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-primary hover:bg-primary/10 flex-shrink-0 mt-2"
                        title="Mover para hoje"
                        onClick={() => handleMoveToToday(t.id)}
                      >
                        <ArrowRight className="h-3.5 w-3.5 mr-1" />
                        <span className="text-[10px]">Hoje</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
