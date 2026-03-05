import { useEffect, useState, useMemo } from "react";
import { fetchTasks, fetchSpaces, updateTask, deleteTask, fetchAllSubtasks, createSubtask, updateSubtask, deleteSubtask } from "@/lib/api";
import { TaskCard } from "@/components/TaskCard";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import { CheckSquare, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceTaskDialog } from "@/components/VoiceTaskDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const dateGroupFilters = [
  { value: "all", label: "All" },
  { value: "todo", label: "To-do" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "done", label: "Done" },
];

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [subtasksMap, setSubtasksMap] = useState<Record<string, any[]>>({});
  const [filter, setFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  
  const [groupBy, setGroupBy] = useState("space");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [followUpTask, setFollowUpTask] = useState<any | null>(null);

  const load = async () => {
    try {
      const [t, s, subs] = await Promise.all([fetchTasks(), fetchSpaces(), fetchAllSubtasks()]);
      setTasks(t);
      setSpaces(s);
      const map: Record<string, any[]> = {};
      for (const sub of subs) {
        if (!map[sub.task_id]) map[sub.task_id] = [];
        map[sub.task_id].push(sub);
      }
      setSubtasksMap(map);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = tasks;
    const today = new Date().toISOString().split("T")[0];
    const in7 = new Date(Date.now() + 6 * 86400000).toISOString().split("T")[0];
    const in30 = new Date(Date.now() + 29 * 86400000).toISOString().split("T")[0];

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
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }
    return result;
  }, [tasks, filter, priorityFilter, search]);

  const grouped = useMemo(() => {
    if (groupBy !== "space") return null;
    const groups: Record<string, { name: string; tasks: any[] }> = {};
    const ungrouped: any[] = [];
    for (const t of filtered) {
      if (t.space_id && t.spaces?.name) {
        if (!groups[t.space_id]) groups[t.space_id] = { name: t.spaces.name, tasks: [] };
        groups[t.space_id].tasks.push(t);
      } else {
        ungrouped.push(t);
      }
    }
    const sortByDate = (tasks: any[]) => tasks.sort((a: any, b: any) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
    Object.values(groups).forEach(g => sortByDate(g.tasks));
    sortByDate(ungrouped);
    return { groups: Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)), ungrouped };
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
      if (newStatus === "completed") setFollowUpTask(task);
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
    try {
      await deleteTask(id);
      toast.success("Task deleted");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-small text-muted-foreground">Loading...</p></div>;
  }

  const renderTaskList = (taskList: any[], hideSpace = false) => (
    <div className="space-y-2">
      {taskList.map(t => (
        <div key={t.id} onClick={() => setEditingTask(t)} className="cursor-pointer">
          <TaskCard
            task={t}
            subtasks={subtasksMap[t.id] || []}
            onToggle={() => toggleTask(t.id)}
            onDelete={() => handleDelete(t.id)}
            onToggleSubtask={toggleSubtask}
            onAddSubtask={handleAddSubtask}
            onDeleteSubtask={handleDeleteSubtask}
            hideSpace={hideSpace}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-title flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-muted-foreground" /> Tasks
          </h1>
          <p className="text-small text-muted-foreground mt-1">{tasks.filter(t => t.status !== "completed").length} active tasks</p>
        </div>
        <div className="flex gap-2">
          <VoiceTaskDialog spaces={spaces.map(s => ({ id: s.id, name: s.name }))} onCreated={load} />
          <CreateTaskDialog spaces={spaces.map(s => ({ id: s.id, name: s.name }))} onCreated={load} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-small" />
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-muted overflow-x-auto w-full sm:w-auto flex-nowrap">
          {dateGroupFilters.map(f => (
            <TabsTrigger key={f.value} value={f.value} className="text-small flex-shrink-0 min-h-[40px] touch-manipulation">{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2 flex-wrap">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[110px] sm:w-[120px] h-10 sm:h-8 text-small touch-manipulation"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="w-[110px] sm:w-[140px] h-10 sm:h-8 text-small touch-manipulation"><SelectValue placeholder="Group by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No grouping</SelectItem>
            <SelectItem value="space">By Space</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filter === "done" && filtered.length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleClearHistory}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpar histórico
          </Button>
        </div>
      )}

      {grouped ? (
        <div className="space-y-6">
          {grouped.groups.map(g => (
            <section key={g.name}>
              <h2 className="text-h2 mb-2">{g.name}</h2>
              <div className="rounded-xl border border-border bg-card p-3">
                {renderTaskList(g.tasks, true)}
              </div>
            </section>
          ))}
          {grouped.ungrouped.length > 0 && (
            <section>
              <h2 className="text-h2 mb-2 text-muted-foreground">No Space</h2>
              {renderTaskList(grouped.ungrouped)}
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

      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          spaces={spaces.map(s => ({ id: s.id, name: s.name }))}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          onUpdated={load}
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
