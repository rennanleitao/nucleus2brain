import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { updateTask } from "@/lib/api";

interface TaskLite {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  estimated_minutes?: number | null;
  scheduled_time?: string | null;
}

interface BusyEvent { summary?: string; start: string; end: string }

interface Suggestion { task_id: string; time: string | null; reason: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string; // YYYY-MM-DD
  tasks: TaskLite[];
  busy: BusyEvent[];
  onApplied: () => void;
}

export function AISchedulePreviewDialog({ open, onOpenChange, date, tasks, busy, onApplied }: Props) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [summary, setSummary] = useState<string>("");

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const fetchSuggestions = async () => {
    if (tasks.length === 0) {
      toast.error("Nenhuma task para organizar");
      return;
    }
    setLoading(true);
    setSuggestions(null);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-day-schedule", {
        body: { date, tasks, busy, workStart, workEnd },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSuggestions(data.schedule || []);
      setSummary(data.summary || "");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar sugestão");
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!suggestions) return;
    setApplying(true);
    try {
      await Promise.all(
        suggestions
          .filter((s) => s.time)
          .map((s) => updateTask(s.task_id, { scheduled_time: s.time } as any))
      );
      toast.success("Horários aplicados!");
      onApplied();
      onOpenChange(false);
      setSuggestions(null);
      setSummary("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Sugerir ordem do dia com IA
          </DialogTitle>
        </DialogHeader>

        {!suggestions && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A IA vai analisar suas {tasks.length} tasks de hoje, considerar prioridade, tempo estimado
              {busy.length > 0 ? ` e ${busy.length} eventos do Google Calendar` : ""}, e sugerir um horário para cada uma.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Início do dia</Label>
                <Input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Fim do dia</Label>
                <Input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="h-9" />
              </div>
            </div>
            <Button onClick={fetchSuggestions} disabled={loading || tasks.length === 0} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar sugestão
            </Button>
          </div>
        )}

        {suggestions && (
          <div className="space-y-3">
            {summary && (
              <div className="rounded-md bg-muted/40 border border-border p-2.5 text-xs text-muted-foreground">
                {summary}
              </div>
            )}
            <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
              {suggestions
                .slice()
                .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"))
                .map((s) => {
                  const t = taskMap.get(s.task_id);
                  if (!t) return null;
                  return (
                    <div key={s.task_id} className="flex items-start gap-2 rounded-md border border-border p-2">
                      <div className="flex items-center gap-1 min-w-[58px] pt-0.5">
                        {s.time ? (
                          <>
                            <Clock className="h-3 w-3 text-primary" />
                            <span className="text-xs font-mono font-semibold">{s.time}</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">—</span>
                          </>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{s.reason}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setSuggestions(null); setSummary(""); }} disabled={applying}>
                Refazer
              </Button>
              <Button onClick={apply} disabled={applying}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Aplicar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
