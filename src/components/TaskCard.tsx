import { forwardRef, useState, useEffect } from "react";
import { CheckCircle2, Circle, Clock, AlertCircle, XCircle, Trash2, CalendarDays, ChevronRight, ChevronDown, ChevronUp, Plus, X, FileText, Tag, Bell, Timer, CalendarClock, LinkIcon, ExternalLink, Copy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchTaskMaterials } from "@/lib/api";
import { getBrtToday, getBrtTomorrow } from "@/lib/timezone";

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
    tag?: string | null;
    estimated_minutes?: number | null;
  };
  subtasks?: Subtask[];
  reminder?: { reminder_time: string; sent: boolean } | null;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleSubtask?: (id: string) => void;
  onAddSubtask?: (taskId: string, title: string, dueDate?: string) => void;
  onDeleteSubtask?: (id: string) => void;
  onPriorityChange?: (id: string, priority: TaskPriority) => void;
  onSelect?: (task: TaskCardProps["task"]) => void;
  onReschedule?: (id: string, newDate: string) => void;
  onRescheduleSubtask?: (id: string, newDate: string) => void;
  onDuplicate?: (id: string) => void;
  hideSpace?: boolean;
  orderNumber?: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  compact?: boolean;
  onToggleCompact?: (id: string) => void;
}

const statusIcons: Record<TaskStatus, React.ElementType> = {
  todo: Circle,
  in_progress: Clock,
  waiting: AlertCircle,
  completed: CheckCircle2,
  cancelled: XCircle,
};

const priorityDots: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const priorityLabels: Record<TaskPriority, string> = { low: "Baixa", medium: "Média", high: "Alta" };
const priorityCycle: TaskPriority[] = ["low", "medium", "high"];

function PriorityDots({ priority, onClick }: { priority: TaskPriority; onClick?: (newPriority: TaskPriority) => void }) {
  const count = priorityDots[priority];
  const handleClick = (e: React.MouseEvent) => {
    if (!onClick) return;
    e.stopPropagation();
    const idx = priorityCycle.indexOf(priority);
    const next = priorityCycle[(idx + 1) % priorityCycle.length];
    onClick(next);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center gap-[3px] ${onClick ? "cursor-pointer hover:opacity-70 transition-opacity" : ""}`}
      title={`Prioridade: ${priorityLabels[priority]}${onClick ? " (clique para alterar)" : ""}`}
    >
      {[1, 2, 3].map(i => (
        <span
          key={i}
          className={`block h-[5px] w-[5px] rounded-full ${i <= count ? "bg-foreground/50" : "bg-border"}`}
        />
      ))}
    </button>
  );
}

function formatDate(dateStr: string) {
  const todayStr = getBrtToday();
  const tomorrowStr = getBrtTomorrow();
  if (dateStr === todayStr) return "Hoje";
  if (dateStr === tomorrowStr) return "Amanhã";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function SubtaskReschedulePopover({ subtaskId, currentDate, onReschedule }: { subtaskId: string; currentDate?: string | null; onReschedule: (id: string, newDate: string) => void }) {
  const [open, setOpen] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const handle = (d: string) => { onReschedule(subtaskId, d); setOpen(false); setShowCal(false); };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setShowCal(false); }}>
      <PopoverTrigger asChild>
        <button onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-primary transition-colors" title="Reprogramar subtask">
          <CalendarClock className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end" side="bottom" onClick={e => e.stopPropagation()}>
        {!showCal ? (
          <div className="flex flex-col p-1 min-w-[140px]">
            <button onClick={() => handle(getBrtToday())} className="flex items-center gap-2 text-left text-sm px-3 py-2 rounded hover:bg-muted transition-colors">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> Hoje
            </button>
            <button onClick={() => handle(getBrtTomorrow())} className="flex items-center gap-2 text-left text-sm px-3 py-2 rounded hover:bg-muted transition-colors">
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
            onSelect={(date) => { if (date) { const y = date.getFullYear(); const m = String(date.getMonth()+1).padStart(2,"0"); const d = String(date.getDate()).padStart(2,"0"); handle(`${y}-${m}-${d}`); }}}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(({
  task, subtasks = [], reminder, onToggle, onDelete, onToggleSubtask, onAddSubtask, onDeleteSubtask, onPriorityChange, onSelect, onReschedule, onRescheduleSubtask, onDuplicate, hideSpace,
  orderNumber, onMoveUp, onMoveDown, isFirst, isLast, compact = false, onToggleCompact
}, ref) => {
  const isCompleted = task.status === "completed";
  const ToggleIcon = isCompleted ? CheckCircle2 : Circle;
  const StatusIcon = statusIcons[task.status];
  const isOverdue = !!(task.due_date && task.due_date < getBrtToday() && !isCompleted);
  const dayDelta = (() => {
    if (!task.due_date) return 0;
    const today = getBrtToday();
    const [ty, tm, td] = today.split("-").map(Number);
    const [dy, dm, dd] = task.due_date.split("-").map(Number);
    const todayMs = Date.UTC(ty, tm - 1, td);
    const dueMs = Date.UTC(dy, dm - 1, dd);
    return Math.round((dueMs - todayMs) / 86400000); // negative = overdue, positive = future
  })();
  const overdueDays = isOverdue ? Math.max(1, -dayDelta) : 0;
  const daysUntil = !isCompleted && dayDelta > 1 ? dayDelta : 0; // skip today (0) and tomorrow (1, already labeled)
  const hasSubtasks = subtasks.length > 0;
  const completedSubtasks = subtasks.filter(s => s.status === "completed").length;
  const reminderTriggered = !!(reminder && new Date(reminder.reminder_time) <= new Date() && !reminder.sent);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);

  const handleReschedule = (dateStr: string) => {
    onReschedule?.(task.id, dateStr);
    setRescheduleOpen(false);
    setShowCustomDate(false);
  };

  const [isOpen, setIsOpen] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDate, setNewSubtaskDate] = useState("");
  const [materials, setMaterials] = useState<any[]>([]);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [newMatTitle, setNewMatTitle] = useState("");
  const [newMatUrl, setNewMatUrl] = useState("");
  const [newMatDesc, setNewMatDesc] = useState("");

  const loadMaterials = async () => {
    const data = await fetchTaskMaterials(task.id);
    setMaterials(data || []);
  };

  useEffect(() => {
    loadMaterials().catch(() => {});
  }, [task.id]);

  useEffect(() => {
    if (materialsOpen) {
      loadMaterials().catch(() => {});
    }
  }, [materialsOpen, task.id]);

  const handleAddMaterialInCard = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newMatTitle.trim() || !newMatUrl.trim()) return;
    try {
      const { createTaskMaterial } = await import("@/lib/api");
      await createTaskMaterial({ task_id: task.id, title: newMatTitle.trim(), url: newMatUrl.trim(), description: newMatDesc.trim() || null });
      await loadMaterials();
      setNewMatTitle(""); setNewMatUrl(""); setNewMatDesc("");
      setAddingMaterial(false);
      toast.success("Material adicionado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteMaterialInCard = async (matId: string) => {
    try {
      const { deleteTaskMaterial } = await import("@/lib/api");
      await deleteTaskMaterial(matId);
      setMaterials(prev => prev.filter(m => m.id !== matId));
      toast.success("Material removido");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

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
    <div ref={ref} className={cn(
      "group rounded-lg border transition-all animate-fade-in hover:shadow-card",
      isOverdue
        ? "border-red-200 bg-red-50/60 hover:bg-red-50"
        : "border-border bg-card",
      isCompleted && "opacity-60"
    )}>
      <div className="flex items-start gap-3 p-3 sm:p-3">
        {/* Botões de reordenar removidos — drag and drop já cobre essa função */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle?.(task.id); }}
          className={`flex-shrink-0 transition-colors w-5 h-5 sm:w-4 sm:h-4 mt-[2px] touch-manipulation ${isCompleted ? "text-muted-foreground" : "text-muted-foreground hover:text-primary"}`}
        >
          <ToggleIcon className="h-5 w-5 sm:h-4 sm:w-4" />
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect?.(task)}>
          <p className={`text-small font-medium leading-tight ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </p>
          {!compact && descriptionPreview && (
            <p className="text-micro text-muted-foreground mt-0.5 line-clamp-2">{descriptionPreview}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {!compact && !hideSpace && task.spaces?.name && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-accent/40 bg-accent/15 text-foreground">
                📁 {task.spaces.name}
              </Badge>
            )}
            {!compact && task.tag && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                <Tag className="h-2.5 w-2.5 mr-0.5" />#{task.tag}
              </Badge>
            )}
            {!compact && task.notes?.title && task.note_id && (
              <button
                onClick={(e) => { e.stopPropagation(); window.location.href = `/notes?note=${task.note_id}`; }}
                title="Criada a partir desta nota — clique para abrir"
              >
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors gap-0.5">
                  <FileText className="h-2.5 w-2.5" />
                  da nota: {task.notes.title}
                </Badge>
              </button>
            )}
            {!compact && task.notes?.title && !task.note_id && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground gap-0.5">
                <FileText className="h-2.5 w-2.5" />
                da nota: {task.notes.title}
              </Badge>
            )}
            {task.due_date && (
              <span className={`text-micro flex items-center gap-1 ${isOverdue ? "text-destructive font-semibold" : task.due_date === getBrtToday() ? "text-primary font-medium" : "text-muted-foreground"}`}>
                <CalendarDays className="h-3 w-3" />
                {formatDate(task.due_date)}
                {isOverdue && (
                  <span className="ml-1 px-1.5 py-0 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold">
                    {overdueDays}d atrasada
                  </span>
                )}
                {daysUntil > 0 && (
                  <span className="ml-1 px-1.5 py-0 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                    em {daysUntil}d
                  </span>
                )}
              </span>
            )}
            {!compact && reminder && !isCompleted && (
              <span className="text-micro flex items-center gap-1 text-muted-foreground">
                {reminderTriggered && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                  </span>
                )}
                <Bell className="h-3 w-3" />
                {new Date(reminder.reminder_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {!compact && hasSubtasks && (
              <span className="text-micro text-muted-foreground">
                {completedSubtasks}/{subtasks.length} subtasks
              </span>
            )}
            {!compact && task.estimated_minutes && (
              <span className="text-micro text-muted-foreground flex items-center gap-0.5">
                <Timer className="h-2.5 w-2.5" />
                {task.estimated_minutes}m est.
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {!isCompleted && onReschedule && (
            <div onClick={e => e.stopPropagation()}>
              <Popover open={rescheduleOpen} onOpenChange={(open) => { setRescheduleOpen(open); if (!open) setShowCustomDate(false); }}>
                <PopoverTrigger asChild>
                  <button
                    className="text-muted-foreground hover:text-primary transition-colors p-1"
                    title="Reprogramar"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end" side="bottom">
                  {!showCustomDate ? (
                    <div className="flex flex-col p-1 min-w-[140px]">
                      <button
                        onClick={() => handleReschedule(getBrtToday())}
                        className="flex items-center gap-2 text-left text-sm px-3 py-2 rounded hover:bg-muted transition-colors"
                      >
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> Hoje
                      </button>
                      <button
                        onClick={() => handleReschedule(getBrtTomorrow())}
                        className="flex items-center gap-2 text-left text-sm px-3 py-2 rounded hover:bg-muted transition-colors"
                      >
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> Amanhã
                      </button>
                      <button
                        onClick={() => setShowCustomDate(true)}
                        className="flex items-center gap-2 text-left text-sm px-3 py-2 rounded hover:bg-muted transition-colors"
                      >
                        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" /> Outra data
                      </button>
                    </div>
                  ) : (
                    <Calendar
                      mode="single"
                      selected={task.due_date ? new Date(task.due_date + "T00:00:00") : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const y = date.getFullYear();
                          const m = String(date.getMonth() + 1).padStart(2, "0");
                          const d = String(date.getDate()).padStart(2, "0");
                          handleReschedule(`${y}-${m}-${d}`);
                        }
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  )}
                </PopoverContent>
              </Popover>
            </div>
          )}

          {!isCompleted && onDuplicate && (
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(task.id); }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all p-1"
              title="Duplicar tarefa"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}

          {/* TaskTimer removido do card — disponível ao abrir o cartão */}
          <PriorityDots priority={task.priority} onClick={onPriorityChange ? (p) => onPriorityChange(task.id, p) : undefined} />
          {onToggleCompact && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleCompact(task.id); }}
              className="text-muted-foreground hover:text-primary transition-colors p-1"
              title={compact ? "Expandir detalhes" : "Recolher detalhes"}
            >
              {compact ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="opacity-0 group-hover:opacity-100 sm:opacity-0 text-muted-foreground hover:text-destructive transition-all flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center -m-2 touch-manipulation">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Subtasks collapsible */}
      {!compact && (hasSubtasks || onAddSubtask) && (
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
                  {onRescheduleSubtask && sub.status !== "completed" && (
                    <SubtaskReschedulePopover subtaskId={sub.id} currentDate={sub.due_date} onReschedule={onRescheduleSubtask} />
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

      {/* Materials - always visible like subtasks */}
      {!compact && (
      <Collapsible open={materialsOpen} onOpenChange={setMaterialsOpen}>
        <div className="px-3 pb-2 flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <CollapsibleTrigger className="flex items-center gap-1 text-micro text-muted-foreground hover:text-foreground transition-colors">
            {materialsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <LinkIcon className="h-3 w-3" />
            {materials.length > 0 ? `${materials.length} ${materials.length === 1 ? "material" : "materiais"}` : "Materiais"}
          </CollapsibleTrigger>
          <button
            onClick={(e) => { e.stopPropagation(); setAddingMaterial(true); setMaterialsOpen(true); }}
            className="ml-auto text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <CollapsibleContent onClick={e => e.stopPropagation()}>
          <div className="px-3 pb-3 space-y-1 ml-4 border-l border-border">
            {materials.map((mat: any) => (
              <div key={mat.id} className="flex items-start gap-2 py-1 group/mat">
                <a href={mat.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 shrink-0 text-primary hover:text-primary/80">
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a href={mat.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 hover:underline">
                  <p className="text-xs font-medium truncate text-foreground">{mat.title}</p>
                  {mat.description && <p className="text-[10px] text-muted-foreground truncate">{mat.description}</p>}
                </a>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteMaterialInCard(mat.id); }}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0 opacity-0 group-hover/mat:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {addingMaterial && (
              <form onSubmit={handleAddMaterialInCard} className="space-y-1.5 pt-1">
                <input type="text" placeholder="Nome do material" value={newMatTitle} onChange={e => setNewMatTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-micro outline-none focus:border-primary"
                  autoFocus onClick={e => e.stopPropagation()} />
                <input type="url" placeholder="https://..." value={newMatUrl} onChange={e => setNewMatUrl(e.target.value)}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-micro outline-none focus:border-primary"
                  onClick={e => e.stopPropagation()} />
                <input type="text" placeholder="Descrição curta (opcional)" value={newMatDesc} onChange={e => setNewMatDesc(e.target.value)}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-micro outline-none focus:border-primary"
                  onClick={e => e.stopPropagation()} />
                <div className="flex items-center gap-2">
                  <button type="submit" disabled={!newMatTitle.trim() || !newMatUrl.trim()}
                    className="text-primary hover:text-primary/80 text-micro font-medium disabled:opacity-50">OK</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setAddingMaterial(false); }}
                    className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
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
