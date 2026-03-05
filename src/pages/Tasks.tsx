import { useEffect, useState } from "react";
import { fetchTasks, fetchSpaces, updateTask, deleteTask } from "@/lib/api";
import { TaskCard } from "@/components/TaskCard";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import { CheckSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const statusFilters = [
  { value: "all", label: "All" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Done" },
];

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [followUpTask, setFollowUpTask] = useState<any | null>(null);

  const load = async () => {
    try {
      const [t, s] = await Promise.all([fetchTasks(), fetchSpaces()]);
      setTasks(t); setSpaces(s);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? tasks.filter(t => t.status !== "completed" && t.status !== "cancelled") : tasks.filter(t => t.status === filter);

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus = task.status === "completed" ? "todo" : "completed";
    try {
      await updateTask(id, { status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null });
      if (newStatus === "completed") {
        setFollowUpTask(task);
      }
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
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-title flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-muted-foreground" /> Tasks
          </h1>
          <p className="text-small text-muted-foreground mt-1">{tasks.filter(t => t.status !== "completed").length} active tasks</p>
        </div>
        <CreateTaskDialog spaces={spaces.map(s => ({ id: s.id, name: s.name }))} onCreated={load} />
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-muted overflow-x-auto w-full sm:w-auto flex-wrap sm:flex-nowrap">
          {statusFilters.map(f => (
            <TabsTrigger key={f.value} value={f.value} className="text-small flex-shrink-0">{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {filtered.length > 0 ? (
          filtered.map(t => (
            <div key={t.id} onClick={() => setEditingTask(t)} className="cursor-pointer">
              <TaskCard task={t} onToggle={() => toggleTask(t.id)} onDelete={() => handleDelete(t.id)} />
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <CheckSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-small text-muted-foreground">No tasks here</p>
          </div>
        )}
      </div>

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
