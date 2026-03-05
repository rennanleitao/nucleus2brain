import { forwardRef } from "react";
import { CheckCircle2, Circle, Clock, AlertCircle, XCircle, Trash2, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type TaskStatus = "todo" | "in_progress" | "waiting" | "completed" | "cancelled";
type TaskPriority = "low" | "medium" | "high";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date?: string | null;
    spaces?: { name: string } | null;
  };
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  hideSpace?: boolean;
}

const statusIcons: Record<TaskStatus, React.ElementType> = {
  todo: Circle,
  in_progress: Clock,
  waiting: AlertCircle,
  completed: CheckCircle2,
  cancelled: XCircle,
};

const priorityStyles: Record<TaskPriority, string> = {
  high: "bg-foreground/10 text-foreground border-foreground/20",
  medium: "bg-muted text-muted-foreground border-border",
  low: "bg-muted text-muted-foreground/60 border-border",
};

function formatDueDate(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return "Hoje";
  if (target.getTime() === tomorrow.getTime()) return "Amanhã";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(({ task, onToggle, onDelete, hideSpace }, ref) => {
  const StatusIcon = statusIcons[task.status];
  const isCompleted = task.status === "completed";
  const isOverdue = !!(task.due_date && new Date(task.due_date) < new Date() && !isCompleted);

  return (
    <div ref={ref} className={`group flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:shadow-card transition-all animate-fade-in ${
      isCompleted ? "opacity-60" : ""
    }`}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle?.(task.id); }}
        className={`mt-0.5 flex-shrink-0 transition-colors ${
          isCompleted ? "text-muted-foreground" : "text-muted-foreground hover:text-primary"
        }`}
      >
        <StatusIcon className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-small font-medium leading-tight ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {!hideSpace && task.spaces?.name && (
            <span className="text-micro text-muted-foreground">{task.spaces.name}</span>
          )}
          {task.due_date && (
            <span className={`text-micro flex items-center gap-1 ${isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
              <CalendarDays className="h-3 w-3" />
              {formatDueDate(task.due_date)}
            </span>
          )}
        </div>
      </div>

      <Badge variant="outline" className={`text-[10px] border ${priorityStyles[task.priority]} flex-shrink-0`}>
        {task.priority}
      </Badge>

      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});

TaskCard.displayName = "TaskCard";
