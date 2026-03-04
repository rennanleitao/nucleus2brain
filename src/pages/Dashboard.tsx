import { useEffect, useState } from "react";
import { fetchTasks, updateTask, fetchSpaces } from "@/lib/api";
import { TaskCard } from "@/components/TaskCard";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Clock, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";
import { toast } from "sonner";

const today = new Date().toISOString().split("T")[0];

function SectionHeader({ icon: Icon, title, count }: { icon: React.ElementType; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{count}</span>
    </div>
  );
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const todayTasks = tasks.filter(t => t.due_date === today && t.status !== "completed");
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < today && t.status !== "completed");
  const upcomingTasks = tasks.filter(t => {
    if (!t.due_date || t.status === "completed") return false;
    const d = new Date(t.due_date);
    const in7 = new Date(Date.now() + 7 * 86400000);
    return d > new Date(today) && d <= in7;
  });

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus = task.status === "completed" ? "todo" : "completed";
    try {
      await updateTask(id, {
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      });
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const activeCount = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").length;

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} active tasks · {overdueTasks.length} overdue
          </p>
        </div>
        <CreateTaskDialog spaces={spaces.map(s => ({ id: s.id, name: s.name }))} onCreated={load} />
      </div>

      {/* AI Briefing */}
      {(todayTasks.length > 0 || overdueTasks.length > 0) && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Focus</span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {overdueTasks.length > 0 && `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} to address. `}
            {todayTasks.length > 0 && `${todayTasks.length} task${todayTasks.length > 1 ? "s" : ""} due today.`}
            {todayTasks.length === 0 && overdueTasks.length === 0 && "All clear! Great job staying on top of things."}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {overdueTasks.length > 0 && (
          <section>
            <SectionHeader icon={AlertTriangle} title="Overdue" count={overdueTasks.length} />
            <div className="space-y-2">
              {overdueTasks.map(t => <TaskCard key={t.id} task={t} onToggle={toggleTask} />)}
            </div>
          </section>
        )}

        <section>
          <SectionHeader icon={Clock} title="Today" count={todayTasks.length} />
          <div className="space-y-2">
            {todayTasks.length > 0 ? (
              todayTasks.map(t => <TaskCard key={t.id} task={t} onToggle={toggleTask} />)
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No tasks due today</p>
            )}
          </div>
        </section>

        {upcomingTasks.length > 0 && (
          <section>
            <SectionHeader icon={TrendingUp} title="Upcoming" count={upcomingTasks.length} />
            <div className="space-y-2">
              {upcomingTasks.map(t => <TaskCard key={t.id} task={t} onToggle={toggleTask} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
