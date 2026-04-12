import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TaskCard } from "@/components/TaskCard";
import { CalendarCheck, ChevronDown, ChevronRight, CalendarClock, AlertTriangle, CalendarPlus, CalendarDays, Link2, Timer } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { updateTask } from "@/lib/api";
import { toast } from "sonner";

function getBrtToday() {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return brt.toISOString().split("T")[0];
}

function getBrtTomorrow() {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  brt.setDate(brt.getDate() + 1);
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
  onReschedule: (id: string, newDate: string) => void;
  onRescheduleSubtask: (id: string, newDate: string) => void;
  onReload: () => void;
}

export function DayPlanner({
  tasks, setTasks, subtasksMap, remindersMap,
  onToggle, onDelete, onToggleSubtask, onAddSubtask,
  onDeleteSubtask, onPriorityChange, onSelect, onReschedule, onRescheduleSubtask, onReload,
}: DayPlannerProps) {
  const navigate = useNavigate();
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [showOverdue, setShowOverdue] = useState(false);
  const [showFuture, setShowFuture] = useState(false);

  const today = getBrtToday();
  const tomorrow = getBrtTomorrow();

  const todayTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date === today)
      .sort((a, b) => {
        const aOrder = a.day_order ?? 999999;
        const bOrder = b.day_order ?? 999999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.created_at.localeCompare(b.created_at);
      });
  }, [tasks, today]);

  // Subtasks with due_date=today whose parent task is NOT today
  const todayOrphanSubtasks = useMemo(() => {
    const todayTaskIds = new Set(todayTasks.map(t => t.id));
    const result: { subtask: any; parentTask: any }[] = [];
    for (const task of tasks) {
      if (todayTaskIds.has(task.id)) continue; // parent already shown in today
      const subs = subtasksMap[task.id] || [];
      for (const sub of subs) {
        if (sub.status !== "completed" && sub.due_date === today) {
          result.push({ subtask: sub, parentTask: task });
        }
      }
    }
    return result;
  }, [tasks, subtasksMap, todayTasks, today]);

  const tomorrowTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date === tomorrow)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [tasks, tomorrow]);

  const overdueTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date < today)
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  }, [tasks, today]);

  const futureTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date > tomorrow)
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  }, [tasks, tomorrow]);

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= todayTasks.length) return;
    const reordered = [...todayTasks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

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

  const renderTaskCardInSection = (t: any) => (
    <div key={t.id} className="cursor-pointer" onClick={() => onSelect(t)}>
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
        onReschedule={onReschedule}
        onRescheduleSubtask={onRescheduleSubtask}
      />
    </div>
  );

  const renderToggleSection = (
    label: string,
    icon: React.ReactNode,
    tasksList: any[],
    expanded: boolean,
    setExpanded: (v: boolean) => void,
    borderColor = "border-border",
    bgColor = "bg-muted/30",
  ) => {
    if (tasksList.length === 0) return null;
    return (
      <div className="space-y-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full text-left group/section"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {icon}
          <span className="text-small font-medium text-muted-foreground">
            {label} ({tasksList.length})
          </span>
        </button>
        {expanded && (
          <div className={`rounded-xl border ${borderColor} ${bgColor} p-3 space-y-2`}>
            {tasksList.map(t => renderTaskCardInSection(t))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary" />
          <h2 className="text-h2">Planejamento do Dia</h2>
          <span className="text-micro text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
            {todayTasks.length + todayOrphanSubtasks.length} item{(todayTasks.length + todayOrphanSubtasks.length) !== 1 ? "s" : ""}
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/pomodoro")}
                className="flex items-center gap-1.5 text-small font-medium text-muted-foreground hover:text-primary border border-border hover:border-primary/30 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <Timer className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Abrir Pomodoro</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Today tasks – reorderable */}
      {(todayTasks.length > 0 || todayOrphanSubtasks.length > 0) ? (
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
                  onReschedule={onReschedule}
                  onRescheduleSubtask={onRescheduleSubtask}
                  orderNumber={idx + 1}
                  onMoveUp={() => handleReorder(idx, idx - 1)}
                  onMoveDown={() => handleReorder(idx, idx + 1)}
                  isFirst={idx === 0}
                  isLast={idx === todayTasks.length - 1}
                />
              </div>
            ))}

            {/* Orphan subtasks for today */}
            {todayOrphanSubtasks.map(({ subtask, parentTask }) => (
              <div
                key={`sub-${subtask.id}`}
                className="rounded-lg border border-border bg-card p-3 flex items-center gap-3 cursor-pointer hover:shadow-card transition-all"
                onClick={() => onSelect(parentTask)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleSubtask(subtask.id); }}
                  className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                >
                  {subtask.status === "completed" ? (
                    <CalendarCheck className="h-4 w-4" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-small font-medium leading-tight">{subtask.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Link2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-micro text-muted-foreground truncate">
                      Subtask de: {parentTask.title}
                    </span>
                  </div>
                </div>
                <div onClick={e => e.stopPropagation()}>
                  <SubtaskRescheduleInline subtaskId={subtask.id} currentDate={subtask.due_date} onReschedule={onRescheduleSubtask} />
                </div>
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

      {/* Tomorrow */}
      {renderToggleSection(
        "Amanhã", <CalendarPlus className="h-3.5 w-3.5 text-muted-foreground" />,
        tomorrowTasks, showTomorrow, setShowTomorrow,
      )}

      {/* Overdue */}
      {renderToggleSection(
        "Atrasadas", <AlertTriangle className="h-3.5 w-3.5 text-destructive" />,
        overdueTasks, showOverdue, setShowOverdue,
        "border-destructive/20", "bg-destructive/5",
      )}

      {/* Future */}
      {renderToggleSection(
        "Atividades futuras", <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />,
        futureTasks, showFuture, setShowFuture,
      )}
    </div>
  );
}

function SubtaskRescheduleInline({ subtaskId, currentDate, onReschedule }: { subtaskId: string; currentDate?: string | null; onReschedule: (id: string, newDate: string) => void }) {
  const [open, setOpen] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const handle = (d: string) => { onReschedule(subtaskId, d); setOpen(false); setShowCal(false); };
  const today = getBrtToday();
  const tomorrow = getBrtTomorrow();

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setShowCal(false); }}>
      <PopoverTrigger asChild>
        <button
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary border border-border hover:border-primary/30 rounded-md px-2 py-1 transition-colors"
          title="Reprogramar"
        >
          <CalendarClock className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end" side="bottom" onClick={e => e.stopPropagation()}>
        {!showCal ? (
          <div className="flex flex-col p-1 min-w-[140px]">
            <button onClick={() => handle(today)} className="flex items-center gap-2 text-left text-sm px-3 py-2 rounded hover:bg-muted transition-colors">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> Hoje
            </button>
            <button onClick={() => handle(tomorrow)} className="flex items-center gap-2 text-left text-sm px-3 py-2 rounded hover:bg-muted transition-colors">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> Amanhã
            </button>
            <button onClick={() => setShowCal(true)} className="flex items-center gap-2 text-left text-sm px-3 py-2 rounded hover:bg-muted transition-colors">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" /> Outra data
            </button>
          </div>
        ) : (
          <Calendar
            mode="single"
            selected={currentDate ? new Date(currentDate + "T00:00:00") : undefined}
            onSelect={(date) => {
              if (date) {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, "0");
                const d = String(date.getDate()).padStart(2, "0");
                handle(`${y}-${m}-${d}`);
              }
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
