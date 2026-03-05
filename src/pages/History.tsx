import { useEffect, useState, useMemo } from "react";
import { fetchTasks, fetchSpaces } from "@/lib/api";
import { History as HistoryIcon, Calendar, FolderOpen } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, isToday, isYesterday, isThisWeek, isThisMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type GroupMode = "date" | "space";

function groupByDate(tasks: any[]) {
  const groups: Record<string, any[]> = {};
  for (const t of tasks) {
    const d = t.completed_at ? parseISO(t.completed_at) : parseISO(t.created_at);
    let label: string;
    if (isToday(d)) label = "Hoje";
    else if (isYesterday(d)) label = "Ontem";
    else if (isThisWeek(d)) label = "Esta semana";
    else if (isThisMonth(d)) label = "Este mês";
    else label = format(d, "MMMM yyyy", { locale: ptBR });
    if (!groups[label]) groups[label] = [];
    groups[label].push(t);
  }
  return groups;
}

function groupBySpace(tasks: any[]) {
  const groups: Record<string, any[]> = {};
  for (const t of tasks) {
    const label = t.spaces?.name || "Sem espaço";
    if (!groups[label]) groups[label] = [];
    groups[label].push(t);
  }
  return groups;
}

export default function History() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupMode, setGroupMode] = useState<GroupMode>("date");

  useEffect(() => {
    (async () => {
      try {
        const t = await fetchTasks();
        setTasks(t.filter((task: any) => task.status === "completed" || task.status === "cancelled"));
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const groups = useMemo(() => {
    return groupMode === "date" ? groupByDate(tasks) : groupBySpace(tasks);
  }, [tasks, groupMode]);

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-muted-foreground" /> Histórico
          </h1>
          <p className="text-small text-muted-foreground mt-1">{tasks.length} atividades concluídas</p>
        </div>
        <Tabs value={groupMode} onValueChange={(v) => setGroupMode(v as GroupMode)}>
          <TabsList className="bg-muted">
            <TabsTrigger value="date" className="text-xs gap-1">
              <Calendar className="h-3 w-3" /> Por data
            </TabsTrigger>
            <TabsTrigger value="space" className="text-xs gap-1">
              <FolderOpen className="h-3 w-3" /> Por espaço
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {Object.keys(groups).length === 0 ? (
        <div className="text-center py-12">
          <HistoryIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma atividade concluída ainda</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-h2 text-foreground capitalize">{label}</h2>
                <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
              </div>
              <div className="space-y-1.5">
                {items.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${t.status === "completed" ? "bg-[hsl(var(--status-completed))]" : "bg-[hsl(var(--status-cancelled))]"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-small text-foreground line-through opacity-70">{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {groupMode === "date" && t.spaces?.name && (
                          <span className="text-[11px] text-muted-foreground">{t.spaces.name}</span>
                        )}
                        {groupMode === "space" && t.completed_at && (
                          <span className="text-[11px] text-muted-foreground">
                            {format(parseISO(t.completed_at), "dd MMM yyyy", { locale: ptBR })}
                          </span>
                        )}
                        {t.description && (
                          <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{t.description}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${t.status === "completed" ? "text-[hsl(var(--status-completed))]" : "text-[hsl(var(--status-cancelled))]"}`}>
                      {t.status === "completed" ? "Concluído" : "Cancelado"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
