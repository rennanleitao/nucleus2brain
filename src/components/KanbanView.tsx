import { useMemo } from "react";
import { TaskCard } from "@/components/TaskCard";
import { CheckSquare, AlertTriangle, Inbox, CalendarDays } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KanbanViewProps {
  tasks: any[];
  subtasksMap: Record<string, any[]>;
  remindersMap: Record<string, any>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSubtask: (id: string) => void;
  onAddSubtask: (taskId: string, title: string, dueDate?: string) => void;
  onDeleteSubtask: (id: string) => void;
  onPriorityChange: (id: string, priority: "low" | "medium" | "high") => void;
  onSelect: (task: any) => void;
}

export function KanbanView({
  tasks,
  subtasksMap,
  remindersMap,
  onToggle,
  onDelete,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onPriorityChange,
  onSelect,
}: KanbanViewProps) {
  const columns = useMemo(() => {
    const now = new Date();
    const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const today = brt.toISOString().split("T")[0];
    const end = new Date(brt);
    end.setDate(end.getDate() + 7);
    const endStr = end.toISOString().split("T")[0];

    const active = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled");

    const overdue: any[] = [];
    const backlog: any[] = [];
    const upcoming: any[] = [];

    for (const t of active) {
      if (!t.due_date) {
        backlog.push(t);
      } else if (t.due_date < today) {
        overdue.push(t);
      } else if (t.due_date <= endStr) {
        upcoming.push(t);
      } else {
        // tasks beyond 7 days go to upcoming too
        upcoming.push(t);
      }
    }

    // Sort by date
    const sortByDate = (a: any, b: any) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    };

    overdue.sort(sortByDate);
    upcoming.sort(sortByDate);

    return [
      {
        key: "overdue",
        label: "Atrasadas",
        icon: AlertTriangle,
        tasks: overdue,
        color: "text-destructive",
        borderColor: "border-destructive/30",
        bgColor: "bg-destructive/5",
      },
      {
        key: "backlog",
        label: "Backlog",
        icon: Inbox,
        tasks: backlog,
        color: "text-muted-foreground",
        borderColor: "border-border",
        bgColor: "bg-muted/30",
      },
      {
        key: "upcoming",
        label: "Próximos 7 dias",
        icon: CalendarDays,
        tasks: upcoming,
        color: "text-primary",
        borderColor: "border-primary/30",
        bgColor: "bg-primary/5",
      },
    ];
  }, [tasks]);

  if (columns.every(c => c.tasks.length === 0)) {
    return (
      <div className="text-center py-12">
        <CheckSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-small text-muted-foreground">Nenhuma task encontrada</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6">
      {columns.map(col => (
        <div
          key={col.key}
          className={`flex-shrink-0 w-[300px] sm:w-[340px] rounded-xl border ${col.borderColor} ${col.bgColor} flex flex-col max-h-[calc(100vh-280px)]`}
        >
          <div className="flex items-center gap-2 p-3 border-b border-border/50">
            <col.icon className={`h-4 w-4 ${col.color}`} />
            <h3 className={`text-sm font-semibold ${col.color}`}>{col.label}</h3>
            <span className="text-micro text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded-md ml-auto">
              {col.tasks.length}
            </span>
          </div>
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-2">
              {col.tasks.map(t => (
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
                  />
                </div>
              ))}
              {col.tasks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma task</p>
              )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
