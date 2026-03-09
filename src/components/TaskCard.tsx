import { forwardRef, useState } from "react";
import { CheckCircle2, Circle, Clock, AlertCircle, XCircle, Trash2, CalendarDays, ChevronRight, ChevronDown, Plus, X, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

type TaskStatus = "todo" | "in_progress" | "waiting" | "completed" | "cancelled";
type TaskPriority = "low" | "medium" | "high";

interface Subtask {
  id: string;
  title: string;
  status: string;
  due_date?: string | null;
}

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description?: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    due_date?: string | null;
    spaces?: { name: string } | null;
    notes?: { title: string } | null;
    note_id?: string | null;
  };
  subtasks?: Subtask[];
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleSubtask?: (id: string) => void;
  onAddSubtask?: (taskId: string, title: string, dueDate?: string) => void;
  onDeleteSubtask?: (id: string) => void;
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

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(({
  task, subtasks = [], onToggle, onDelete, onToggleSubtask, onAddSubtask, onDeleteSubtask, hideSpace
}, ref) => {
  const isCompleted = task.status === "completed";
  const ToggleIcon = isCompleted ? CheckCircle2 : Circle;
  const StatusIcon = statusIcons[task.status];
  const isOverdue = !!(task.due_date && new Date(task.due_date) < new Date() && !isCompleted);
  const hasSubtasks = subtasks.length > 0;
  const completedSubtasks = subtasks.filter(s => s.status === "completed").length;

  const [isOpen, setIsOpen] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDate, setNewSubtaskDate] = useState("");

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newSubtaskTitle.trim()) return;
    if (newSubtaskDate && task.due_date && newSubtaskDate > task.due_date) {
      toast.error("Data da subtask não pode ser posterior à data da task");
      return;
    }
    onAddSubtask?.(task.id, newSubtaskTitle.trim(), newSubtaskDate || undefined);
    setNewSubtaskTitle("");
    setNewSubtaskDate("");
    setAddingSubtask(false);
  };

  const descriptionPreview = task.description?.replace(/<[^>]*>/g, "").trim();

  return (
    <div ref={ref} className={`group rounded-lg border border-border bg-card hover:shadow-card transition-all animate-fade-in ${isCompleted ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3 p-3 sm:p-3">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle?.(task.id); }}
          className={`flex-shrink-0 transition-colors w-5 h-5 sm:w-4 sm:h-4 mt-[2px] touch-manipulation ${isCompleted ? "text-muted-foreground" : "text-muted-foreground hover:text-primary"}`}
        >
          <ToggleIcon className="h-5 w-5 sm:h-4 sm:w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-small font-medium leading-tight ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </p>
          {descriptionPreview && (
            <p className="text-micro text-muted-foreground mt-0.5 line-clamp-1">{descriptionPreview}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {!hideSpace && task.spaces?.name && (
              <span className="text-micro text-muted-foreground">{task.spaces.name}</span>
            )}
            {task.notes?.title && (
              <span className="text-micro text-muted-foreground flex items-center gap-0.5">
                <FileText className="h-3 w-3" />
                {task.notes.title}
              </span>
            )}
            {task.due_date && (
              <span className={`text-micro flex items-center gap-1 ${isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                <CalendarDays className="h-3 w-3" />
                {formatDate(task.due_date)}
              </span>
            )}
            {hasSubtasks && (
              <span className="text-micro text-muted-foreground">
                {completedSubtasks}/{subtasks.length} subtasks
              </span>
            )}
          </div>
        </div>

        <Badge variant="outline" className={`text-[10px] border ${priorityStyles[task.priority]} flex-shrink-0`}>
          {task.priority}
        </Badge>

        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="opacity-0 group-hover:opacity-100 sm:opacity-0 text-muted-foreground hover:text-destructive transition-all flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center -m-2 touch-manipulation">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Subtasks collapsible */}
      {(hasSubtasks || onAddSubtask) && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="px-3 pb-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <CollapsibleTrigger className="flex items-center gap-1 text-micro text-muted-foreground hover:text-foreground transition-colors">
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {hasSubtasks ? "Subtasks" : "Adicionar subtask"}
            </CollapsibleTrigger>
            {onAddSubtask && (
              <button
                onClick={(e) => { e.stopPropagation(); setAddingSubtask(true); setIsOpen(true); }}
                className="ml-auto text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
          <CollapsibleContent onClick={(e) => e.stopPropagation()}>
            <div className="px-3 pb-3 space-y-1 ml-4 border-l border-border">
              {subtasks.map(sub => (
                <div key={sub.id} className="flex items-center gap-2 py-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleSubtask?.(sub.id); }}
                    className={`flex-shrink-0 transition-colors ${sub.status === "completed" ? "text-muted-foreground" : "text-muted-foreground hover:text-primary"}`}
                  >
                    {sub.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  </button>
                  <span className={`text-micro flex-1 ${sub.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                    {sub.title}
                  </span>
                  {sub.due_date && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <CalendarDays className="h-2.5 w-2.5" />
                      {formatDate(sub.due_date)}
                    </span>
                  )}
                  {onDeleteSubtask && (
                    <button onClick={(e) => { e.stopPropagation(); onDeleteSubtask(sub.id); }}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {addingSubtask && (
                <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Título da subtask"
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    className="flex-1 bg-background border border-border rounded px-2 py-1 text-micro outline-none focus:border-primary"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                  <input
                    type="date"
                    value={newSubtaskDate}
                    onChange={e => setNewSubtaskDate(e.target.value)}
                    className="bg-background border border-border rounded px-1 py-1 text-[10px] outline-none focus:border-primary w-[110px]"
                    onClick={e => e.stopPropagation()}
                  />
                  <button type="submit" className="text-primary hover:text-primary/80 text-micro font-medium">OK</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setAddingSubtask(false); }}
                    className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </form>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
});

TaskCard.displayName = "TaskCard";
