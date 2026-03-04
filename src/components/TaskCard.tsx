import { forwardRef } from "react";
import { CheckCircle2, Circle, Clock, AlertCircle, XCircle, Trash2 } from "lucide-react";
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
}

const statusIcons: Record<TaskStatus, React.ElementType> = {
  todo: Circle,
  in_progress: Clock,
  waiting: AlertCircle,
  completed: CheckCircle2,
  cancelled: XCircle,
};

const priorityStyles: Record<TaskPriority, string> = {
  high: "bg-priority-high/10 text-priority-high border-priority-high/20",
  medium: "bg-priority-medium/10 text-priority-medium border-priority-medium/20",
  low: "bg-priority-low/10 text-priority-low border-priority-low/20",
};

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(({ task, onToggle, onDelete }, ref) => {
  const StatusIcon = statusIcons[task.status];
  const isCompleted = task.status === "completed";
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isCompleted;

  return (
    <div ref={ref} className={`group flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:shadow-card transition-all animate-fade-in ${
      isCompleted ? "opacity-60" : ""
    }`}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle?.(task.id); }}
        className={`mt-0.5 flex-shrink-0 transition-colors ${
          isCompleted ? "text-status-completed" : "text-muted-foreground hover:text-primary"
        }`}
      >
        <StatusIcon className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight ${isCompleted ? "line-through" : ""}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          {task.spaces?.name && (
            <span className="text-[11px] text-muted-foreground">{task.spaces.name}</span>
          )}
          {task.due_date && (
            <span className={`text-[11px] ${isOverdue ? "text-priority-high font-medium" : "text-muted-foreground"}`}>
              {isOverdue ? "Overdue" : new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
