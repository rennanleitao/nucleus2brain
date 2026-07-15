import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { User, Users, GripVertical } from "lucide-react";
import { TaskCard } from "@/components/TaskCard";
import { updateTask } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  tasks: any[];
  /** Optional grouping (e.g. Atrasadas / Hoje / Amanhã). If provided, tasks are ignored for rendering but still used to look up drag targets. */
  groups?: { label: string; tasks: any[]; accent?: string }[];
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
}: {
  id: ColumnId;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  empty: string;
  children: React.ReactNode;
  accent?: string;
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

export function TasksByOwnerView(props: Props) {
  const {
    tasks, groups, subtasksMap, remindersMap, onToggle, onDelete, onToggleSubtask,
    onAddSubtask, onDeleteSubtask, onPriorityChange, onReschedule,
    onRescheduleSubtask, onDuplicate, onSelect, cardCompact, onToggleCardCompact,
    allCompact, onReload,
  } = props;

  const [activeId, setActiveId] = useState<string | null>(null);
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

  const columnData = useMemo(() => {
    if (groups && groups.length > 0) {
      const mineGroups = groups.map(g => ({ label: g.label, accent: g.accent, tasks: splitByOwner(g.tasks).mine }));
      const othersGroups = groups.map(g => ({ label: g.label, accent: g.accent, tasks: splitByOwner(g.tasks).others }));
      const mineCount = mineGroups.reduce((s, g) => s + g.tasks.length, 0);
      const othersCount = othersGroups.reduce((s, g) => s + g.tasks.length, 0);
      return { mineGroups, othersGroups, mineCount, othersCount };
    }
    const { mine, others } = splitByOwner(tasks);
    return {
      mineGroups: [{ label: "", accent: undefined as string | undefined, tasks: mine }],
      othersGroups: [{ label: "", accent: undefined as string | undefined, tasks: others }],
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
        const name = window.prompt(`Quem está executando "${task.title}"?`, task.delegated_to || "");
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
        <p className="text-[11px] text-muted-foreground mt-1 pl-1">
          Executada por <span className="font-medium text-foreground">{t.delegated_to}</span>
        </p>
      )}
    </div>
  );

  const renderGroups = (grps: { label: string; accent?: string; tasks: any[] }[]) => {
    const useSections = groups && groups.length > 0;
    return grps.map((g, idx) => {
      if (useSections && g.tasks.length === 0) return null;
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
    </DndContext>
  );
}
