import { useEffect, useState, useMemo } from "react";
import { fetchAllTimeEntries } from "@/lib/api";
import { Timer, Clock } from "lucide-react";
import { formatTotalTime } from "@/components/TaskTimer";
import { toast } from "sonner";

export default function TimeTracking() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllTimeEntries()
      .then(setEntries)
      .catch((err: any) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, { taskTitle: string; spaceName: string | null; totalSeconds: number; entries: any[] }> = {};
    for (const e of entries) {
      const key = e.task_id;
      if (!map[key]) {
        map[key] = {
          taskTitle: e.tasks?.title || "Task removida",
          spaceName: e.tasks?.spaces?.name || null,
          totalSeconds: 0,
          entries: [],
        };
      }
      map[key].totalSeconds += e.duration_seconds || 0;
      map[key].entries.push(e);
    }
    return Object.entries(map)
      .sort((a, b) => b[1].totalSeconds - a[1].totalSeconds);
  }, [entries]);

  const grandTotal = useMemo(() => entries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0), [entries]);

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-small text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-title flex items-center gap-2">
          <Timer className="h-5 w-5 text-muted-foreground" /> Time Tracking
        </h1>
        <p className="text-small text-muted-foreground mt-1">
          Total investido: <span className="font-semibold text-foreground">{formatTotalTime(grandTotal)}</span>
        </p>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-12">
          <Timer className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-small text-muted-foreground">Nenhum tempo registrado ainda</p>
          <p className="text-micro text-muted-foreground mt-1">Use o botão ▶ nas tasks para começar a registrar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([taskId, data]) => (
            <div key={taskId} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <p className="text-small font-medium truncate">{data.taskTitle}</p>
                  {data.spaceName && <p className="text-micro text-muted-foreground">{data.spaceName}</p>}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-small font-semibold">{formatTotalTime(data.totalSeconds)}</p>
                  <p className="text-micro text-muted-foreground">{data.entries.length} sessões</p>
                </div>
              </div>
              <div className="space-y-1 mt-2 border-t border-border pt-2">
                {data.entries.slice(0, 5).map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between text-micro text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(entry.started_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      {" "}
                      {new Date(entry.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {entry.ended_at && (
                        <> — {new Date(entry.ended_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
                      )}
                    </span>
                    <span>{entry.duration_seconds ? formatTotalTime(entry.duration_seconds) : "em andamento"}</span>
                  </div>
                ))}
                {data.entries.length > 5 && (
                  <p className="text-[10px] text-muted-foreground">+{data.entries.length - 5} sessões anteriores</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
