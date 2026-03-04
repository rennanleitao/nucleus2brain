import { useState } from "react";
import { mockTasks, mockEvents } from "@/data/mockData";
import { TaskCard } from "@/components/TaskCard";
import { CalendarEvent, Task } from "@/types";
import { Clock, AlertTriangle, CalendarDays, Sparkles, TrendingUp } from "lucide-react";

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

function MeetingCard({ event }: { event: CalendarEvent }) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const fmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card animate-fade-in">
      <div className="w-1 h-8 rounded-full gradient-primary flex-shrink-0" />
      <div>
        <p className="text-sm font-medium">{event.title}</p>
        <p className="text-xs text-muted-foreground">{fmt(start)} – {fmt(end)}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);

  const todayTasks = tasks.filter(t => t.dueDate === today && t.status !== "completed");
  const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== "completed");
  const upcomingTasks = tasks.filter(t => {
    if (!t.dueDate || t.status === "completed") return false;
    const d = new Date(t.dueDate);
    const in7 = new Date(Date.now() + 7 * 86400000);
    return d > new Date(today) && d <= in7;
  });
  const todayEvents = mockEvents.filter(e => e.startTime.startsWith(today));

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status: t.status === "completed" ? "todo" : "completed" } : t
    ));
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {todayTasks.length + overdueTasks.length} tasks need attention · {todayEvents.length} meeting{todayEvents.length !== 1 ? "s" : ""} today
        </p>
      </div>

      {/* AI Briefing */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">AI Briefing</span>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">
          Focus on <strong>finishing the Profectum proposal</strong> first — it's high priority and due today. 
          Then prepare for your <strong>V.Tal meeting</strong> at 15:00. You have {overdueTasks.length} overdue task{overdueTasks.length !== 1 ? "s" : ""} that need attention.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
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
                <p className="text-sm text-muted-foreground py-4 text-center">All clear for today! 🎉</p>
              )}
            </div>
          </section>

          <section>
            <SectionHeader icon={TrendingUp} title="Upcoming" count={upcomingTasks.length} />
            <div className="space-y-2">
              {upcomingTasks.map(t => <TaskCard key={t.id} task={t} onToggle={toggleTask} />)}
            </div>
          </section>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <section>
            <SectionHeader icon={CalendarDays} title="Meetings Today" count={todayEvents.length} />
            <div className="space-y-2">
              {todayEvents.length > 0 ? (
                todayEvents.map(e => <MeetingCard key={e.id} event={e} />)
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No meetings today</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
