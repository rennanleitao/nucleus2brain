import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchTasks, createTask, updateTask } from "@/lib/api";
import { getBrtToday } from "@/lib/timezone";
import { appendFocusLog, useFocusCheckIn } from "@/hooks/useFocusCheckIn";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function FocusCheckInDialog() {
  const { user } = useAuth();
  const { due, dismiss, snooze, settings } = useFocusCheckIn();
  const [tasks, setTasks] = useState<any[]>([]);
  const [other, setOther] = useState("");
  const [offPlan, setOffPlan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const today = getBrtToday();

  useEffect(() => {
    if (!due || !user) return;
    setOther("");
    setOffPlan(null);
    fetchTasks()
      .then((t) => setTasks(t || []))
      .catch(() => setTasks([]));
  }, [due, user]);

  const planTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.due_date === today && t.status !== "completed" && t.status !== "cancelled",
      ),
    [tasks, today],
  );

  const close = () => {
    setOffPlan(null);
    dismiss();
  };

  const pickTask = async (task: any) => {
    setBusy(true);
    try {
      if (task.status === "todo") {
        await updateTask(task.id, { status: "in_progress" });
      }
      appendFocusLog({ at: new Date().toISOString(), activity: task.title, aligned: true, taskId: task.id });
      toast.success("Alinhado com o plano do dia");
      close();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitOther = () => {
    const text = other.trim();
    if (!text) return;
    appendFocusLog({ at: new Date().toISOString(), activity: text, aligned: false });
    setOffPlan(text);
  };

  const addToPlan = async () => {
    if (!offPlan) return;
    setBusy(true);
    try {
      await createTask({ title: offPlan, priority: "medium", due_date: today, status: "in_progress" } as any);
      toast.success("Adicionado ao plano de hoje");
      close();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!user || !settings.enabled) return null;

  return (
    <Dialog open={due} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] overflow-hidden">

        <DialogHeader>
          <DialogTitle className="text-base">O que você está fazendo agora?</DialogTitle>
          <DialogDescription className="text-xs">
            Um instante para conferir se sua atenção está no plano de hoje.
          </DialogDescription>
        </DialogHeader>

        {offPlan ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm">"{offPlan}" não está no plano de hoje.</p>
                <p className="text-xs text-muted-foreground">
                  Quer trazer isso para o plano ou voltar ao que estava previsto?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={addToPlan} disabled={busy} className="w-full">
                Adicionar ao plano de hoje
              </Button>
              <Button variant="outline" onClick={close} disabled={busy} className="w-full">
                Continuar assim mesmo
              </Button>
              <Button variant="ghost" onClick={() => setOffPlan(null)} className="w-full text-xs">
                Voltar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5 max-h-56 overflow-auto">
              {planTasks.length > 0 ? (
                planTasks.map((t) => (
                  <button
                    key={t.id}
                    disabled={busy}
                    onClick={() => pickTask(t)}
                    className="w-full min-w-0 text-left flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/60 transition-colors disabled:opacity-50"
                  >
                    {t.status === "in_progress" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-2">
                  Nenhuma atividade prevista para hoje.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Está em outra coisa?</p>
              <div className="flex gap-2">
                <Input
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitOther(); }}
                  placeholder="Descreva rapidamente..."
                  className="text-sm"
                />
                <Button variant="outline" onClick={submitOther} disabled={!other.trim()}>
                  Ok
                </Button>
              </div>
            </div>

            <div className="flex justify-between pt-1">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => snooze(10)}>
                Lembrar em 10 min
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={close}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
