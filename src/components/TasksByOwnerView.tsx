import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { User, Users, GripVertical, CalendarDays, Gauge, Plus, Send, Mail, MessageCircle, Copy } from "lucide-react";
import { TaskCard } from "@/components/TaskCard";
import { updateTask } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DelegateCommDialog } from "@/components/DelegateCommDialog";
import { promptDialog } from "@/components/ui/dialog-service";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildDelegateMessage } from "@/lib/delegate-messages";

type Subgroup = { label: string; reference?: string; tasks: any[] };
type Group = {
  label: string;
  tasks: any[];
  accent?: string;
  /** "date" gives the section the same colored header used by the day planner. */
  variant?: "date" | "plain";
  tone?: "today" | "overdue" | "default";
  subgroups?: Subgroup[];
};

interface Props {
  tasks: any[];
  /** Optional grouping. If provided, tasks are still used to look up drag targets. */
  groups?: Group[];
  subtasksMap: Record<string, any[]>;
  remindersMap: Record<string, any>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSubtask: (id: string) => void;
  onAddSubtask: (taskId: string, title: string, dueDate?: string) => void;
  onDeleteSubtask: (id: string) => void;
  onPriorityChange: (id: string, priority: "low" | "medium" | "high") => void;
  onReschedule: (id: string, newDate: string) => void;
  onRescheduleSubtask: (id: string, newDate: string) => void;
  onDuplicate: (id: string) => void;
  onSelect: (task: any) => void;
  cardCompact: (id: string) => boolean;
  onToggleCardCompact: (id: string) => void;
  allCompact: boolean;
  onReload: () => void;
  onDelegate?: () => void;
}

type ColumnId = "mine" | "others";

function DraggableTask({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div ref={setNodeRef} className={cn("relative group", isDragging && "opacity-30")}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastar tarefa"
        className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      {children}
    </div>
  );
}

function DroppableColumn({
  id,
  title,
  icon: Icon,
  count,
  empty,
  children,
  accent,
  action,
}: {
  id: ColumnId;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  empty: string;
  children: React.ReactNode;
  accent?: string;
  action?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-card transition-colors min-h-[400px]",
        isOver ? "border-primary bg-primary/5" : "border-border"
      )}
    >
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className={cn("h-7 w-7 rounded-full flex items-center justify-center", accent ?? "bg-muted")}>
          <Icon className="h-3.5 w-3.5 text-foreground" />
        </div>
        <h2 className="text-sm font-semibold flex-1">{title}</h2>
        <span className="text-micro text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{count}</span>
        {action}
      </header>
      <div className="flex-1 p-3 space-y-2">
        {count === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-10 border border-dashed border-border rounded-lg">
            {empty}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function QuickCommButton({
  channel,
  task,
  label,
  Icon,
  onOpenFull,
}: {
  channel: "email" | "whatsapp";
  task: any;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  onOpenFull: () => void;
}) {
  const [open, setOpen] = useState(false);

  const handleCopy = async () => {
    const { body } = buildDelegateMessage(task);
    try {
      await navigator.clipboard.writeText(body);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
    setOpen(false);
  };

  const handleSend = () => {
    const { subject, body } = buildDelegateMessage(task);
    if (channel === "whatsapp") {
      const url = `https://wa.me/?text=${encodeURIComponent(body)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = url;
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center rounded-md border border-border/70 bg-background hover:bg-muted h-5 w-5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={label}
          title={label}
        >
          <Icon className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-1 flex items-center gap-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleSend}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Send className="h-3 w-3" /> Enviar
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Copy className="h-3 w-3" /> Copiar
        </button>
        <button
          type="button"
          onClick={() => { onOpenFull(); setOpen(false); }}
          className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Editar…
        </button>
      </PopoverContent>
    </Popover>
  );
}

export function TasksByOwnerView(props: Props) {
  const {
    tasks, groups, subtasksMap, remindersMap, onToggle, onDelete, onToggleSubtask,
    onAddSubtask, onDeleteSubtask, onPriorityChange, onReschedule,
    onRescheduleSubtask, onDuplicate, onSelect, cardCompact, onToggleCardCompact,
    allCompact, onReload, onDelegate,
  } = props;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [commTask, setCommTask] = useState<any | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const splitByOwner = (arr: any[]) => {
    const mine: any[] = [];
    const others: any[] = [];
    for (const t of arr) {
      if (t.delegated_to && String(t.delegated_to).trim()) others.push(t);
      else mine.push(t);
    }
    return { mine, others };
  };

  const filterGroupByOwner = (g: Group, owner: "mine" | "others"): Group => {
    const pick = (arr: any[]) => splitByOwner(arr)[owner];
    const filteredTasks = pick(g.tasks);
    const subgroups = g.subgroups
      ? g.subgroups
          .map(sg => ({ ...sg, tasks: pick(sg.tasks) }))
          .filter(sg => sg.tasks.length > 0)
      : undefined;
    return { ...g, tasks: filteredTasks, subgroups };
  };

  const columnData = useMemo(() => {
    if (groups && groups.length > 0) {
      const mineGroups = groups.map(g => filterGroupByOwner(g, "mine"));
      const othersGroups = groups.map(g => filterGroupByOwner(g, "others"));
      const mineCount = mineGroups.reduce((s, g) => s + g.tasks.length, 0);
      const othersCount = othersGroups.reduce((s, g) => s + g.tasks.length, 0);
      return { mineGroups, othersGroups, mineCount, othersCount };
    }
    const { mine, others } = splitByOwner(tasks);
    return {
      mineGroups: [{ label: "", tasks: mine } as Group],
      othersGroups: [{ label: "", tasks: others } as Group],
      mineCount: mine.length,
      othersCount: others.length,
    };
  }, [groups, tasks]);

  const allTasks = useMemo(() => {
    if (groups && groups.length > 0) return groups.flatMap(g => g.tasks);
    return tasks;
  }, [groups, tasks]);

  const activeTask = activeId ? allTasks.find(t => t.id === activeId) : null;

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const dropCol = e.over.id as ColumnId;
    const task = allTasks.find(t => t.id === e.active.id);
    if (!task) return;
    const currentCol: ColumnId = task.delegated_to ? "others" : "mine";
    if (dropCol === currentCol) return;
    try {
      if (dropCol === "others") {
        const name = await promptDialog({
          title: "Delegar tarefa",
          description: `Quem está executando "${task.title}"?`,
          defaultValue: task.delegated_to || "",
          placeholder: "Nome da pessoa",
          confirmLabel: "Delegar",
          required: true,
        });
        if (!name || !name.trim()) return;
        await updateTask(task.id, { delegated_to: name.trim() } as any);
        toast.success(`Delegada para ${name.trim()}`);
      } else {
        await updateTask(task.id, { delegated_to: null } as any);
        toast.success("Trazida de volta para você");
      }
      onReload();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const renderCard = (t: any) => (
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
        onDuplicate={onDuplicate}
        compact={cardCompact(t.id)}
        onToggleCompact={allCompact ? onToggleCardCompact : undefined}
      />
      {t.delegated_to && (
        <div className="flex items-center gap-1.5 mt-1 pl-1" onClick={(e) => e.stopPropagation()}>
          <p className="text-[11px] text-muted-foreground">
            Executada por <span className="font-medium text-foreground">{t.delegated_to}</span>
          </p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setCommTask(t); }}
            className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background hover:bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Comunicar responsável"
            title="Comunicar responsável"
          >
            Comunicar
          </button>
          <QuickCommButton
            channel="whatsapp"
            task={t}
            label="Comunicar por WhatsApp"
            Icon={MessageCircle}
            onOpenFull={() => setCommTask(t)}
          />
          <QuickCommButton
            channel="email"
            task={t}
            label="Comunicar por e-mail"
            Icon={Mail}
            onOpenFull={() => setCommTask(t)}
          />
        </div>
      )}
    </div>
  );

  const renderGroups = (grps: Group[]) => {
    const useSections = groups && groups.length > 0;
    return grps.map((g, idx) => {
      if (useSections && g.tasks.length === 0) return null;

      // Day-planner-style container (date header + complexity subgroups)
      if (g.variant === "date") {
        const isToday = g.tone === "today";
        const isOverdue = g.tone === "overdue";
        return (
          <div
            key={g.label || idx}
            className={cn(
              "rounded-xl border overflow-hidden",
              idx > 0 && "mt-3",
              isToday ? "border-primary/30 bg-primary/5"
                : isOverdue ? "border-destructive/30 bg-destructive/5"
                : "border-border bg-card",
            )}
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
              <CalendarDays className={cn("h-3.5 w-3.5", isToday ? "text-primary" : isOverdue ? "text-destructive" : "text-muted-foreground")} />
              <h3 className="text-sm font-semibold text-foreground truncate">{g.label}</h3>
              <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded-md ml-auto">
                {g.tasks.length}
              </span>
            </div>
            <div className="p-2 space-y-2">
              {g.subgroups && g.subgroups.length > 0 ? (
                g.subgroups.map(sg => (
                  <div key={sg.label} className="rounded-lg border border-border/60 bg-background/60 overflow-hidden">
                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/30 border-b border-border/60">
                      <Gauge className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">{sg.label}</span>
                      {sg.reference && <span className="text-[10px] text-muted-foreground">· {sg.reference}</span>}
                      <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded-md ml-auto">
                        {sg.tasks.length}
                      </span>
                    </div>
                    <div className="p-2 space-y-2">
                      {sg.tasks.map(t => (
                        <DraggableTask key={t.id} id={t.id}>{renderCard(t)}</DraggableTask>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                g.tasks.map(t => (
                  <DraggableTask key={t.id} id={t.id}>{renderCard(t)}</DraggableTask>
                ))
              )}
            </div>
          </div>
        );
      }

      // Fallback plain section
      return (
        <div key={g.label || idx} className={cn(useSections && idx > 0 && "mt-3")}>
          {useSections && g.label && (
            <div className="flex items-center gap-2 mb-1.5 px-0.5">
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", g.accent || "text-muted-foreground")}>
                {g.label}
              </span>
              <span className="text-[10px] text-muted-foreground">({g.tasks.length})</span>
              <div className="flex-1 h-px bg-border/60" />
            </div>
          )}
          <div className="space-y-2">
            {g.tasks.map(t => (
              <DraggableTask key={t.id} id={t.id}>{renderCard(t)}</DraggableTask>
            ))}
          </div>
        </div>
      );
    });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <DroppableColumn
          id="mine"
          title="Executadas por mim"
          icon={User}
          count={columnData.mineCount}
          empty="Arraste aqui as tarefas que voltarem para você."
        >
          {renderGroups(columnData.mineGroups)}
        </DroppableColumn>

        <DroppableColumn
          id="others"
          title="Executadas por outros"
          icon={Users}
          count={columnData.othersCount}
          empty="Arraste aqui as tarefas delegadas para outra pessoa."
          accent="bg-primary/10"
          action={onDelegate ? (
            <button
              type="button"
              onClick={onDelegate}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background hover:bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Delegar nova tarefa"
              title="Delegar nova tarefa"
            >
              <Plus className="h-3.5 w-3.5" /> Delegar
            </button>
          ) : undefined}
        >
          {renderGroups(columnData.othersGroups)}
        </DroppableColumn>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="rotate-1 shadow-lg opacity-90 pointer-events-none">
            <TaskCard
              task={activeTask}
              subtasks={subtasksMap[activeTask.id] || []}
              reminder={remindersMap[activeTask.id] || null}
              onToggle={() => {}}
              onDelete={() => {}}
              onToggleSubtask={() => {}}
              onAddSubtask={() => {}}
              onDeleteSubtask={() => {}}
              onPriorityChange={() => {}}
              onReschedule={() => {}}
              onRescheduleSubtask={() => {}}
              onDuplicate={() => {}}
              compact
            />
          </div>
        ) : null}
      </DragOverlay>
      {commTask && (
        <DelegateCommDialog
          open={!!commTask}
          onOpenChange={(o) => { if (!o) setCommTask(null); }}
          task={{
            title: commTask.title,
            description: commTask.description,
            due_date: commTask.due_date,
            delegated_to: commTask.delegated_to,
          }}
        />
      )}
    </DndContext>
  );
}
