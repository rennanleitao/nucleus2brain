import { Task, TaskPriority, TaskStatus } from "@/types";
import { CheckCircle2, Circle, Clock, AlertCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TaskCardProps {
  task: Task;
  onToggle?: (id: string) => void;
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

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const StatusIcon = statusIcons[task.status];
  const isCompleted = task.status === "completed";
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;

  return (
    <div className={`group flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:shadow-card transition-all cursor-pointer animate-fade-in ${
      isCompleted ? "opacity-60" : ""
    }`}>
      <button
        onClick={() => onToggle?.(task.id)}
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
          {task.spaceName && (
            <span className="text-[11px] text-muted-foreground">{task.spaceName}</span>
          )}
          {task.dueDate && (
            <span className={`text-[11px] ${isOverdue ? "text-priority-high font-medium" : "text-muted-foreground"}`}>
              {isOverdue ? "Overdue" : new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>

      <Badge variant="outline" className={`text-[10px] border ${priorityStyles[task.priority]} flex-shrink-0`}>
        {task.priority}
      </Badge>
    </div>
  );
}
