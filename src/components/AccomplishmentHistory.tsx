import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, Circle, Trash2, History, Calendar, BarChart3 } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getBrtToday } from "@/lib/timezone";

interface Task {
  id: string;
  title: string;
  status: string;
  completed_at?: string | null;
  due_date?: string | null;
}

interface Props {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
}

export function AccomplishmentHistory({ tasks, onSelectTask, onDeleteTask }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"days" | "week" | "month">("days");

  const today = getBrtToday();

  const historyData = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === "completed" && t.completed_at);

    // Group by day
    const byDay: Record<string, Task[]> = {};
    for (const t of completedTasks) {
      const day = t.completed_at!.split("T")[0];
      if (day === today) continue; // skip today, already shown above
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(t);
    }

    const sortedDays = Object.keys(byDay).sort((a, b) => b.localeCompare(a)).slice(0, 30);

    // Weekly stats
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const thisWeekCompleted = completedTasks.filter(t => {
      const d = parseISO(t.completed_at!);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    });

    const lastWeekStart = subDays(weekStart, 7);
    const lastWeekEnd = subDays(weekStart, 1);
    const lastWeekCompleted = completedTasks.filter(t => {
      const d = parseISO(t.completed_at!);
      return isWithinInterval(d, { start: lastWeekStart, end: lastWeekEnd });
    });

    // Monthly stats
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const thisMonthCompleted = completedTasks.filter(t => {
      const d = parseISO(t.completed_at!);
      return isWithinInterval(d, { start: monthStart, end: monthEnd });
    });

    // Daily average this month
    const daysElapsed = Math.max(1, now.getDate());
    const dailyAvg = (thisMonthCompleted.length / daysElapsed).toFixed(1);

    return { byDay, sortedDays, thisWeekCompleted, lastWeekCompleted, thisMonthCompleted, dailyAvg };
  }, [tasks, today]);

  const toggleDay = (day: string) => setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));

  const weekDiff = historyData.thisWeekCompleted.length - historyData.lastWeekCompleted.length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setHistoryOpen(!historyOpen)}
        className="w-full p-3 border-b border-border flex items-center gap-2 hover:bg-muted/30 transition-colors"
      >
        {historyOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <History className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold flex-1 text-left">Histórico de Produtividade</span>
        <span className="text-micro text-muted-foreground">{historyData.thisMonthCompleted.length} este mês</span>
      </button>

      {historyOpen && (
        <div className="p-4 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-micro text-muted-foreground mb-1">Esta semana</p>
              <p className="text-lg font-bold text-foreground">{historyData.thisWeekCompleted.length}</p>
              {weekDiff !== 0 && (
                <p className={`text-micro ${weekDiff > 0 ? "text-green-500" : "text-destructive"}`}>
                  {weekDiff > 0 ? "+" : ""}{weekDiff} vs anterior
                </p>
              )}
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-micro text-muted-foreground mb-1">Este mês</p>
              <p className="text-lg font-bold text-foreground">{historyData.thisMonthCompleted.length}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-micro text-muted-foreground mb-1">Média/dia</p>
              <p className="text-lg font-bold text-foreground">{historyData.dailyAvg}</p>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
            {(["days", "week", "month"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex-1 text-micro py-1.5 rounded-md transition-colors ${viewMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {mode === "days" ? "Dias" : mode === "week" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>

          {/* Day-by-day history */}
          {viewMode === "days" && (
            <div className="space-y-1">
              {historyData.sortedDays.length === 0 ? (
                <p className="text-small text-muted-foreground text-center py-3">Nenhum histórico disponível</p>
              ) : (
                historyData.sortedDays.map(day => {
                  const dayTasks = historyData.byDay[day];
                  const isExpanded = expandedDays[day];
                  const label = format(parseISO(day), "EEEE, dd MMM", { locale: ptBR });

                  return (
                    <div key={day}>
                      <button
                        onClick={() => toggleDay(day)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-small capitalize flex-1 text-left">{label}</span>
                        <span className="text-micro text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{dayTasks.length}</span>
                      </button>
                      {isExpanded && (
                        <div className="ml-7 space-y-0.5 mb-1">
                          {dayTasks.map(t => (
                            <div
                              key={t.id}
                              className="group/item flex items-center gap-2 text-small rounded-md px-1.5 py-1 hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => onSelectTask(t)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              <span className="line-through text-muted-foreground truncate flex-1">{t.title}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); onDeleteTask(t.id); }}
                                className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Weekly view */}
          {viewMode === "week" && (
            <div className="space-y-2">
              {(() => {
                const weeks: { label: string; count: number }[] = [];
                const now = new Date();
                for (let i = 0; i < 4; i++) {
                  const ws = startOfWeek(subDays(now, i * 7), { weekStartsOn: 1 });
                  const we = endOfWeek(subDays(now, i * 7), { weekStartsOn: 1 });
                  const count = tasks.filter(t => t.status === "completed" && t.completed_at && isWithinInterval(parseISO(t.completed_at), { start: ws, end: we })).length;
                  const label = i === 0 ? "Esta semana" : i === 1 ? "Semana passada" : `${format(ws, "dd/MM")} - ${format(we, "dd/MM")}`;
                  weeks.push({ label, count });
                }
                const max = Math.max(...weeks.map(w => w.count), 1);
                return weeks.map((w, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-small text-muted-foreground w-28 flex-shrink-0 truncate">{w.label}</span>
                    <div className="flex-1 h-5 rounded bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded bg-primary/70 transition-all flex items-center justify-end px-1.5"
                        style={{ width: `${Math.max((w.count / max) * 100, 8)}%` }}
                      >
                        <span className="text-micro text-primary-foreground font-medium">{w.count}</span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* Monthly view */}
          {viewMode === "month" && (
            <div className="space-y-2">
              {(() => {
                const months: { label: string; count: number }[] = [];
                const now = new Date();
                for (let i = 0; i < 3; i++) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  const ms = startOfMonth(d);
                  const me = endOfMonth(d);
                  const count = tasks.filter(t => t.status === "completed" && t.completed_at && isWithinInterval(parseISO(t.completed_at), { start: ms, end: me })).length;
                  const label = format(d, "MMMM yyyy", { locale: ptBR });
                  months.push({ label, count });
                }
                const max = Math.max(...months.map(m => m.count), 1);
                return months.map((m, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-small text-muted-foreground w-28 flex-shrink-0 capitalize truncate">{m.label}</span>
                    <div className="flex-1 h-5 rounded bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded bg-primary/70 transition-all flex items-center justify-end px-1.5"
                        style={{ width: `${Math.max((m.count / max) * 100, 8)}%` }}
                      >
                        <span className="text-micro text-primary-foreground font-medium">{m.count}</span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
