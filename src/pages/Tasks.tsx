import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fetchTasks, fetchSpaces, updateTask, deleteTask, restoreTask, fetchAllSubtasks, createSubtask, updateSubtask, deleteSubtask, fetchReminders, duplicateTask, fetchDeletedTasks, permanentlyDeleteTask, generateNextRecurrence } from "@/lib/api";
import { TaskCard } from "@/components/TaskCard";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import { CompletionCommentDialog } from "@/components/CompletionCommentDialog";
import { CheckSquare, Search, SlidersHorizontal, Trash2, Plus, ChevronDown, ChevronRight, LayoutList, Columns3, CalendarCheck, Minimize2, Maximize2, RotateCcw, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceTaskDialog } from "@/components/VoiceTaskDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { KanbanView } from "@/components/KanbanView";
import { DayPlanner } from "@/components/DayPlanner";
import {
  TASK_EXECUTION_COMPLEXITIES,
  getTaskExecutionComplexityOrder,
  taskExecutionComplexityDurationReference,
  taskExecutionComplexityLabels,
} from "@/lib/taskComplexity";

const dateGroupFilters = [
  { value: "all", label: "All" },
  { value: "planner", label: "Day Planner", icon: CalendarCheck },
  { value: "todo", label: "To-do" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "done", label: "Done" },
  { value: "deleted", label: "Deleted" },
];

export default function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [subtasksMap, setSubtasksMap] = useState<Record<string, any[]>>({});
  const [remindersMap, setRemindersMap] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState("planner");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [complexityFilter, setComplexityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  
  const [groupBy, setGroupBy] = useState("space");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletedTasks, setDeletedTasks] = useState<any[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [followUpTask, setFollowUpTask] = useState<any | null>(null);
  const [completionTask, setCompletionTask] = useState<any | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  const [allCompact, setAllCompact] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  // Card is compact when global compact mode is on AND user hasn't individually expanded it
  const cardCompact = (id: string) => allCompact && !expandedCards[id];
  const toggleCardCompact = (id: string) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  const handleToggleAllCompact = () => {
    setAllCompact(prev => !prev);
    setExpandedCards({});
  };

  const load = async () => {
    try {
      const [t, s, subs, rems] = await Promise.all([fetchTasks(), fetchSpaces(), fetchAllSubtasks(), fetchReminders()]);
      setTasks(t);
      setSpaces(s);
      const map: Record<string, any[]> = {};
      for (const sub of subs) {
        if (!map[sub.task_id]) map[sub.task_id] = [];
        map[sub.task_id].push(sub);
      }
      setSubtasksMap(map);
      const rMap: Record<string, any> = {};
      for (const r of rems) {
        if (r.task_id) rMap[r.task_id] = r;
      }
      setRemindersMap(rMap);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadDeleted = async () => {
    setLoadingDeleted(true);
    try {
      const d = await fetchDeletedTasks();
      setDeletedTasks(d);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingDeleted(false);
    }
  };

  useEffect(() => {
    if (filter === "deleted") loadDeleted();
  }, [filter]);

  const handleRestoreFromDeleted = async (id: string) => {
    try {
      await restoreTask(id);
      setDeletedTasks(prev => prev.filter(t => t.id !== id));
      toast.success("Tarefa restaurada");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      await permanentlyDeleteTask(id);
      setDeletedTasks(prev => prev.filter(t => t.id !== id));
      toast.success("Tarefa removida permanentemente");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const remainingTime = (deletedAt: string) => {
    const expires = new Date(deletedAt).getTime() + 24 * 60 * 60 * 1000;
    const ms = expires - Date.now();
    if (ms <= 0) return "expirando";
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (h > 0) return `${h}h ${m}m restantes`;
    return `${m}m restantes`;
  };

  const filtered = useMemo(() => {
    let result = tasks;
    const now = new Date();
    const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const today = brt.toISOString().split("T")[0];
    const brt7 = new Date(brt); brt7.setDate(brt7.getDate() + 6);
    const in7 = brt7.toISOString().split("T")[0];
    const brt30 = new Date(brt); brt30.setDate(brt30.getDate() + 29);
    const in30 = brt30.toISOString().split("T")[0];

    if (filter === "all") {
      result = result.filter(t => t.status !== "completed" && t.status !== "cancelled");
    } else if (filter === "todo") {
      result = result.filter(t => !t.due_date && t.status !== "completed" && t.status !== "cancelled");
    } else if (filter === "today") {
      result = result.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date <= today);
    } else if (filter === "week") {
      result = result.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date >= today && t.due_date <= in7);
    } else if (filter === "month") {
      result = result.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date >= today && t.due_date <= in30);
    } else if (filter === "done") {
      result = result.filter(t => t.status === "completed");
    }

    if (priorityFilter !== "all") {
      result = result.filter(t => t.priority === priorityFilter);
    }
    if (complexityFilter !== "all") {
      result = result.filter(t => (t.execution_complexity || "medium") === complexityFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }

    const sorted = [...result];
    sorted.sort((a: any, b: any) => {
      if (sortBy === "complexity") {
        const byComplexity = getTaskExecutionComplexityOrder(a.execution_complexity) - getTaskExecutionComplexityOrder(b.execution_complexity);
        if (byComplexity !== 0) return byComplexity;
      } else if (sortBy === "priority") {
        const priorityOrder: Record<string, number> = { high: 1, medium: 2, low: 3 };
        const byPriority = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        if (byPriority !== 0) return byPriority;
      }

      if (!a.due_date && !b.due_date) return a.created_at.localeCompare(b.created_at) * -1;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });

    return sorted;
  }, [tasks, filter, priorityFilter, complexityFilter, search, sortBy]);

  const grouped = useMemo(() => {
    const sortByDate = (tasks: any[]) => tasks.sort((a: any, b: any) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });

    if (groupBy === "date") {
      const now = new Date();
      const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const today = brt.toISOString().split("T")[0];
      const tomorrow = new Date(brt);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      const endOfWeek = new Date(brt);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      const weekStr = endOfWeek.toISOString().split("T")[0];

      const overdue: any[] = [];
      const todayTasks: any[] = [];
      const tomorrowTasks: any[] = [];
      const thisWeek: any[] = [];
      const later: any[] = [];
      const noDate: any[] = [];

      for (const t of filtered) {
        if (!t.due_date) { noDate.push(t); }
        else if (t.due_date < today && t.status !== "completed") { overdue.push(t); }
        else if (t.due_date === today) { todayTasks.push(t); }
        else if (t.due_date === tomorrowStr) { tomorrowTasks.push(t); }
        else if (t.due_date <= weekStr) { thisWeek.push(t); }
        else { later.push(t); }
      }

      const dateGroups: { key: string; label: string; tasks: any[] }[] = [];
      if (overdue.length) dateGroups.push({ key: "overdue", label: "Atrasadas", tasks: sortByDate(overdue) });
      if (todayTasks.length) dateGroups.push({ key: "today", label: "Hoje", tasks: sortByDate(todayTasks) });
      if (tomorrowTasks.length) dateGroups.push({ key: "tomorrow", label: "Amanhã", tasks: sortByDate(tomorrowTasks) });
      if (thisWeek.length) dateGroups.push({ key: "week", label: "Esta semana", tasks: sortByDate(thisWeek) });
      if (later.length) dateGroups.push({ key: "later", label: "Mais tarde", tasks: sortByDate(later) });
      if (noDate.length) dateGroups.push({ key: "nodate", label: "Sem data", tasks: noDate });

      return { type: "date" as const, dateGroups };
    }

    if (groupBy === "complexity") {
      return {
        type: "complexity" as const,
        complexityGroups: TASK_EXECUTION_COMPLEXITIES.map(level => ({
          key: level,
          label: taskExecutionComplexityLabels[level],
          description: taskExecutionComplexityDurationReference[level],
          tasks: sortByDate(filtered.filter(t => (t.execution_complexity || "medium") === level)),
        })),
      };
    }

    if (groupBy !== "space") return null;
    const groups: Record<string, { id: string; name: string; tasks: any[] }> = {};
    const ungrouped: any[] = [];
    for (const t of filtered) {
      if (t.space_id && t.spaces?.name) {
        if (!groups[t.space_id]) groups[t.space_id] = { id: t.space_id, name: t.spaces.name, tasks: [] };
        groups[t.space_id].tasks.push(t);
      } else {
        ungrouped.push(t);
      }
    }
    Object.values(groups).forEach(g => sortByDate(g.tasks));
    sortByDate(ungrouped);
    return { type: "space" as const, groups: Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)), ungrouped };
  }, [filtered, groupBy]);

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const subs = subtasksMap[id] || [];
    if (task.status !== "completed" && subs.length > 0) {
      const incomplete = subs.filter(s => s.status !== "completed");
      if (incomplete.length > 0) {
        toast.error(`Conclua todas as ${incomplete.length} subtask(s) antes de concluir a task`);
        return;
      }
    }
    const newStatus = task.status === "completed" ? "todo" : "completed";
    try {
      await updateTask(id, { status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null });
      if (newStatus === "completed") {
        // Generate next occurrence if recurring
        if ((task as any).recurrence) {
          try {
            const next = await generateNextRecurrence(id);
            if (next) toast.success(`Próxima ocorrência criada para ${next.due_date}`);
          } catch (err: any) {
            console.error("Failed to generate recurrence:", err);
          }
        }
        setCompletionTask(task);
      }
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };


  const toggleSubtask = async (subId: string) => {
    // Find the subtask
    let sub: any = null;
    for (const subs of Object.values(subtasksMap)) {
      sub = subs.find((s: any) => s.id === subId);
      if (sub) break;
    }
    if (!sub) return;
    const newStatus = sub.status === "completed" ? "todo" : "completed";
    try {
      await updateSubtask(subId, {
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      });
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddSubtask = async (taskId: string, title: string, dueDate?: string) => {
    try {
      await createSubtask({ task_id: taskId, title, due_date: dueDate || null });
      toast.success("Subtask adicionada");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteSubtask = async (id: string) => {
    try {
      await deleteSubtask(id);
      toast.success("Subtask removida");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleClearHistory = async () => {
    const completedTasks = tasks.filter(t => t.status === "completed");
    if (completedTasks.length === 0) return;
    try {
      await Promise.all(completedTasks.map(t => deleteTask(t.id)));
      toast.success(`${completedTasks.length} tarefa(s) concluída(s) removida(s)`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    const removed = tasks.find(t => t.id === id);
    // Optimistic UI removal
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await deleteTask(id);
      toast.success("Tarefa excluída", {
        description: removed?.title ? `"${removed.title}" será removida em 24h` : "Será removida em 24h",
        duration: 8000,
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              await restoreTask(id);
              toast.success("Tarefa restaurada");
              load();
            } catch (err: any) {
              toast.error(err.message);
            }
          },
        },
      });
    } catch (err: any) {
      toast.error(err.message);
      load();
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-small text-muted-foreground">Loading...</p></div>;
  }

  const handlePriorityChange = async (id: string, priority: "low" | "medium" | "high") => {
    try {
      await updateTask(id, { priority });
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReschedule = async (id: string, newDate: string) => {
    try {
      await updateTask(id, { due_date: newDate } as any);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date: newDate } : t));
      toast.success("Data atualizada");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTask(id);
      toast.success("Tarefa duplicada");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRescheduleSubtask = async (id: string, newDate: string) => {
    try {
      await updateSubtask(id, { due_date: newDate });
      setSubtasksMap(prev => {
        const updated = { ...prev };
        for (const taskId of Object.keys(updated)) {
          updated[taskId] = updated[taskId].map(s => s.id === id ? { ...s, due_date: newDate } : s);
        }
        return updated;
      });
      toast.success("Data da subtask atualizada");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const renderTaskList = (taskList: any[], hideSpace = false) => (
    <div className="space-y-2">
      {taskList.map((t) => (
        <div key={t.id} onClick={() => setEditingTask(t)} className="cursor-pointer">
          <TaskCard
            task={t}
            subtasks={subtasksMap[t.id] || []}
            reminder={remindersMap[t.id] || null}
            onToggle={() => toggleTask(t.id)}
            onDelete={() => handleDelete(t.id)}
            onToggleSubtask={toggleSubtask}
            onAddSubtask={handleAddSubtask}
            onDeleteSubtask={handleDeleteSubtask}
            onPriorityChange={handlePriorityChange}
            onReschedule={handleReschedule}
            onRescheduleSubtask={handleRescheduleSubtask}
            hideSpace={hideSpace}
            onDuplicate={handleDuplicate}
            compact={cardCompact(t.id)}
            onToggleCompact={allCompact ? toggleCardCompact : undefined}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Buscar em ${tasks.filter(t => t.status !== "completed").length} tasks ativas...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-small h-9"
          />
        </div>
        <VoiceTaskDialog spaces={spaces.map(s => ({ id: s.id, name: s.name }))} onCreated={load} />
        <CreateTaskDialog spaces={spaces.map(s => ({ id: s.id, name: s.name }))} onCreated={load} />
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-muted overflow-x-auto w-full sm:w-auto flex-nowrap">
          {dateGroupFilters.map(f => (
            <TabsTrigger key={f.value} value={f.value} className="text-small flex-shrink-0 min-h-[40px] touch-manipulation">{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filter !== "planner" && filter !== "deleted" && (
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 h-10 sm:h-8 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              title="Lista"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-2 h-10 sm:h-8 transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              title="Kanban"
            >
              <Columns3 className="h-4 w-4" />
            </button>
          </div>
          {viewMode === "list" && (
            <>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[110px] sm:w-[120px] h-10 sm:h-8 text-small touch-manipulation"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={complexityFilter} onValueChange={setComplexityFilter}>
                <SelectTrigger className="w-[136px] sm:w-[170px] h-10 sm:h-8 text-small touch-manipulation"><SelectValue placeholder="Complexidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas complexidades</SelectItem>
                  {TASK_EXECUTION_COMPLEXITIES.map(level => (
                    <SelectItem key={level} value={level}>{taskExecutionComplexityLabels[level]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[120px] sm:w-[150px] h-10 sm:h-8 text-small touch-manipulation"><SelectValue placeholder="Ordenar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Ordenar: data</SelectItem>
                  <SelectItem value="priority">Ordenar: prioridade</SelectItem>
                  <SelectItem value="complexity">Ordenar: complexidade</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-[110px] sm:w-[140px] h-10 sm:h-8 text-small touch-manipulation"><SelectValue placeholder="Group by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grouping</SelectItem>
                  <SelectItem value="space">By Space</SelectItem>
                  <SelectItem value="date">By Date</SelectItem>
                  <SelectItem value="complexity">Por Complexidade</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          <button
            onClick={handleToggleAllCompact}
            className={`flex items-center gap-1.5 px-2.5 h-10 sm:h-8 text-small rounded-md border transition-colors touch-manipulation ${allCompact ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
            title={allCompact ? "Expandir todas" : "Recolher todas"}
          >
            {allCompact ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{allCompact ? "Expandir" : "Recolher"}</span>
          </button>
        </div>
      )}

      {filter === "deleted" ? (
        <div className="space-y-2">
          {loadingDeleted ? (
            <p className="text-small text-muted-foreground text-center py-8">Carregando...</p>
          ) : deletedTasks.length === 0 ? (
            <div className="text-center py-12">
              <Trash2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-small text-muted-foreground">Nenhuma tarefa deletada</p>
              <p className="text-micro text-muted-foreground mt-1">Itens deletados ficam aqui por 24h antes de sumirem</p>
            </div>
          ) : (
            <>
              <p className="text-micro text-muted-foreground mb-2">
                {deletedTasks.length} tarefa(s) deletada(s) · removidas permanentemente após 24h
              </p>
              {deletedTasks.map(t => (
                <div key={t.id} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-small font-medium truncate">{t.title}</p>
                    <p className="text-micro text-muted-foreground">
                      {t.spaces?.name && <span>{t.spaces.name} · </span>}
                      {remainingTime(t.deleted_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestoreFromDeleted(t.id)}
                    className="flex items-center gap-1 px-2.5 h-8 text-micro rounded-md border border-border hover:bg-muted transition-colors"
                    title="Restaurar"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Restaurar</span>
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(t.id)}
                    className="flex items-center gap-1 px-2.5 h-8 text-micro rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                    title="Excluir permanentemente"
                  >
                    <Trash className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Excluir</span>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      ) : filter === "planner" ? (
        <DayPlanner
          tasks={tasks}
          setTasks={setTasks}
          subtasksMap={subtasksMap}
          remindersMap={remindersMap}
          onToggle={toggleTask}
          onDelete={handleDelete}
          onToggleSubtask={toggleSubtask}
          onAddSubtask={handleAddSubtask}
          onDeleteSubtask={handleDeleteSubtask}
          onPriorityChange={handlePriorityChange}
          onSelect={setEditingTask}
          onReschedule={handleReschedule}
          onRescheduleSubtask={handleRescheduleSubtask}
          onDuplicate={handleDuplicate}
          onReload={load}
        />
      ) : viewMode === "kanban" ? (
        <KanbanView
          tasks={filtered}
          subtasksMap={subtasksMap}
          remindersMap={remindersMap}
          onToggle={toggleTask}
          onDelete={handleDelete}
          onToggleSubtask={toggleSubtask}
          onAddSubtask={handleAddSubtask}
          onDeleteSubtask={handleDeleteSubtask}
          onPriorityChange={handlePriorityChange}
          onSelect={setEditingTask}
          cardCompact={cardCompact}
          onToggleCardCompact={toggleCardCompact}
          allCompact={allCompact}
        />
      ) : (
      <>
      {filter === "done" && filtered.length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleClearHistory}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpar histórico
          </Button>
        </div>
      )}

      {grouped && grouped.type === "date" ? (
        <div className="space-y-6">
          {grouped.dateGroups.map(g => {
            const isOpen = collapsedGroups[g.key] !== true;
            return (
              <section key={g.key}>
                <button onClick={() => toggleGroup(g.key)} className="flex items-center gap-2 mb-2 text-left">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  <h2 className={`text-h2 ${g.key === "overdue" ? "text-destructive" : ""}`}>{g.label}</h2>
                  <span className="text-micro text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{g.tasks.length}</span>
                </button>
                {isOpen && (
                  <div className="rounded-xl border border-border bg-card p-3">
                    {renderTaskList(g.tasks)}
                  </div>
                )}
              </section>
            );
          })}
          {grouped.dateGroups.length === 0 && (
            <div className="text-center py-12">
              <CheckSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-small text-muted-foreground">No tasks match filters</p>
            </div>
          )}
        </div>
      ) : grouped && grouped.type === "complexity" ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-h2">Por Complexidade</h2>
            <p className="text-micro text-muted-foreground">Agrupado pela dificuldade de iniciar a tarefa.</p>
          </div>
          {grouped.complexityGroups.map(g => {
            const isOpen = collapsedGroups[g.key] !== true;
            return (
              <section key={g.key}>
                <button onClick={() => toggleGroup(g.key)} className="flex items-center gap-2 mb-2 text-left">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  <h2 className="text-h2">{g.label}</h2>
                  <span className="text-micro text-muted-foreground">{g.description}</span>
                  <span className="text-micro text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{g.tasks.length}</span>
                </button>
                {isOpen && (
                  g.tasks.length > 0 ? (
                    <div className="rounded-xl border border-border bg-card p-3">
                      {renderTaskList(g.tasks)}
                    </div>
                  ) : (
                    <p className="text-small text-muted-foreground border border-dashed border-border rounded-lg p-4">Nenhuma tarefa neste nível.</p>
                  )
                )}
              </section>
            );
          })}
        </div>
      ) : grouped && grouped.type === "space" ? (
        <div className="space-y-6">
          {grouped.groups.map(g => {
            const key = g.name;
            const isOpen = collapsedGroups[key] !== true;
            return (
              <section key={g.name}>
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => toggleGroup(key)} className="flex items-center gap-2 text-left">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    <h2 className="text-h2 hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/spaces/${g.id}`); }}>{g.name}</h2>
                    <span className="text-micro text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{g.tasks.length}</span>
                  </button>
                  <CreateTaskDialog
                    spaces={spaces.map(s => ({ id: s.id, name: s.name }))}
                    onCreated={load}
                    defaultSpaceId={spaces.find(s => s.name === g.name)?.id}
                    trigger={
                      <button className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-md hover:bg-muted">
                        <Plus className="h-4 w-4" />
                      </button>
                    }
                  />
                </div>
                {isOpen && (
                  <div className="rounded-xl border border-border bg-card p-3">
                    {renderTaskList(g.tasks, true)}
                  </div>
                )}
              </section>
            );
          })}
          {grouped.ungrouped.length > 0 && (
            <section>
              <button onClick={() => toggleGroup("__ungrouped")} className="flex items-center gap-2 mb-2 text-left">
                {collapsedGroups["__ungrouped"] !== true ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <h2 className="text-h2 text-muted-foreground">No Space</h2>
                <span className="text-micro text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{grouped.ungrouped.length}</span>
              </button>
              {collapsedGroups["__ungrouped"] !== true && renderTaskList(grouped.ungrouped)}
            </section>
          )}
          {grouped.groups.length === 0 && grouped.ungrouped.length === 0 && (
            <div className="text-center py-12">
              <CheckSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-small text-muted-foreground">No tasks match filters</p>
            </div>
          )}
        </div>
      ) : (
        filtered.length > 0 ? renderTaskList(filtered) : (
          <div className="text-center py-12">
            <CheckSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-small text-muted-foreground">No tasks here</p>
          </div>
        )
      )}
      </>
      )}

      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          spaces={spaces.map(s => ({ id: s.id, name: s.name }))}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          onUpdated={load}
        />
      )}

      {completionTask && (
        <CompletionCommentDialog
          task={completionTask}
          open={!!completionTask}
          onOpenChange={(open) => !open && setCompletionTask(null)}
          onDone={() => { setCompletionTask(null); setFollowUpTask(completionTask); load(); }}
        />
      )}

      {followUpTask && (
        <FollowUpDialog
          completedTask={followUpTask}
          spaces={spaces.map(s => ({ id: s.id, name: s.name }))}
          open={!!followUpTask}
          onOpenChange={(open) => !open && setFollowUpTask(null)}
          onCreated={load}
        />
      )}
    </div>
  );
}
