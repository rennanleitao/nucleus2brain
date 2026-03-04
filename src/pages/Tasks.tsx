import { useState } from "react";
import { mockTasks } from "@/data/mockData";
import { TaskCard } from "@/components/TaskCard";
import { Task, TaskStatus } from "@/types";
import { CheckSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusFilters: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Done" },
];

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status: t.status === "completed" ? "todo" : "completed" } : t
    ));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-muted-foreground" /> Tasks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{tasks.filter(t => t.status !== "completed").length} active tasks</p>
        </div>
        <Button size="sm" className="gradient-primary text-primary-foreground border-0">
          <Plus className="h-4 w-4 mr-1" /> New Task
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-muted">
          {statusFilters.map(f => (
            <TabsTrigger key={f.value} value={f.value} className="text-xs">{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {filtered.length > 0 ? (
          filtered.map(t => <TaskCard key={t.id} task={t} onToggle={toggleTask} />)
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">No tasks in this view</p>
        )}
      </div>
    </div>
  );
}
