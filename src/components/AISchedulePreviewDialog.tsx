import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Clock, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Plus, Minus, GripVertical, ArrowRight, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { updateTask } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TaskLite {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  estimated_minutes?: number | null;
  scheduled_time?: string | null;
}

interface BusyEvent { summary?: string; start: string; end: string }

interface Suggestion {
  task_id: string;
  time: string | null;
  duration_minutes: number;
  reason: string;
}

interface TriageAnswer {
  type?: string;
  urgency?: string;
  complexity?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
  tasks: TaskLite[];
  overdueTasks?: TaskLite[];
  busy: BusyEvent[];
  onApplied: () => void;
}

const TYPE_OPTIONS = [
  { label: "Ligação rápida", mins: 10 },
  { label: "E-mail simples", mins: 15 },
  { label: "Tarefa rápida", mins: 15 },
  { label: "Trabalho focado", mins: 60 },
  { label: "Reunião", mins: 45 },
  { label: "Outro", mins: 30 },
];
const URGENCY_OPTIONS = ["Urgente hoje", "Pode esperar", "Deadline rígido"];
const COMPLEXITY_OPTIONS = ["Simples", "Média", "Complexa"];

type Phase = "config" | "triage" | "loading" | "preview";

// ─── helpers ────────────────────────────────────────────────────
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (mins: number) => {
  const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const snap5 = (mins: number) => Math.round(mins / 5) * 5;

export function AISchedulePreviewDialog({ open, onOpenChange, date, tasks, overdueTasks = [], busy, onApplied }: Props) {
  const [phase, setPhase] = useState<Phase>("config");
  const [applying, setApplying] = useState(false);
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [summary, setSummary] = useState<string>("");

  // Effective task list considering the include-overdue choice.
  const effectiveTasks = useMemo(
    () => (includeOverdue ? [...tasks, ...overdueTasks] : tasks),
    [tasks, overdueTasks, includeOverdue]
  );

  // Triage state: only ask for tasks without estimated_minutes.
  const tasksToTriage = useMemo(
    () => effectiveTasks.filter((t) => !t.estimated_minutes),
    [effectiveTasks]
  );
  const [triageIdx, setTriageIdx] = useState(0);
  const [triageAnswers, setTriageAnswers] = useState<Record<string, TriageAnswer>>({});

  const taskMap = useMemo(() => new Map(effectiveTasks.map((t) => [t.id, t])), [effectiveTasks]);

  useEffect(() => {
    if (open) {
      setPhase("config");
      setSuggestions([]);
      setSummary("");
      setTriageIdx(0);
      setTriageAnswers({});
      setIncludeOverdue(true);
    }
  }, [open]);

  // ─── flow ──────────────────────────────────────────────────────
  const startTriage = () => {
    if (effectiveTasks.length === 0) {
      toast.error("Nenhuma task para organizar");
      return;
    }
    if (tasksToTriage.length === 0) {
      fetchSuggestions();
    } else {
      setPhase("triage");
    }
  };

  const setAnswer = (taskId: string, field: keyof TriageAnswer, value: string) => {
    setTriageAnswers((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], [field]: value },
    }));
  };

  const nextTriage = () => {
    if (triageIdx < tasksToTriage.length - 1) setTriageIdx(triageIdx + 1);
    else fetchSuggestions();
  };

  const fetchSuggestions = async () => {
    setPhase("loading");
    try {
      // Inject estimated_minutes from triage type when missing.
      const enrichedTasks = effectiveTasks.map((t) => {
        const ans = triageAnswers[t.id];
        let est = t.estimated_minutes ?? null;
        if (!est && ans?.type) {
          const opt = TYPE_OPTIONS.find((o) => o.label === ans.type);
          if (opt) est = opt.mins;
        }
        return { ...t, estimated_minutes: est, triage: ans };
      });

      const { data, error } = await supabase.functions.invoke("suggest-day-schedule", {
        body: { date, tasks: enrichedTasks, busy, workStart, workEnd },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const sched: Suggestion[] = (data.schedule || []).map((s: any) => ({
        task_id: s.task_id,
        time: s.time,
        duration_minutes: snap5(Math.max(5, s.duration_minutes ?? 30)),
        reason: s.reason,
      }));
      setSuggestions(sched);
      setSummary(data.summary || "");
      setPhase("preview");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar sugestão");
      setPhase(tasksToTriage.length > 0 ? "triage" : "config");
    }
  };

  // ─── preview edits ─────────────────────────────────────────────
  const adjustTime = (taskId: string, deltaMin: number) => {
    setSuggestions((prev) =>
      prev.map((s) => {
        if (s.task_id !== taskId || !s.time) return s;
        return { ...s, time: toHHMM(snap5(toMin(s.time) + deltaMin)) };
      })
    );
  };
  const adjustDuration = (taskId: string, deltaMin: number) => {
    setSuggestions((prev) =>
      prev.map((s) => {
        if (s.task_id !== taskId) return s;
        return { ...s, duration_minutes: Math.max(5, snap5(s.duration_minutes + deltaMin)) };
      })
    );
  };

  // ─── drag and drop on a 15-min mini-timeline ───────────────────
  const TL_START = toMin(workStart);
  const TL_END = toMin(workEnd);
  const TL_TOTAL = Math.max(60, TL_END - TL_START);
  const SLOT = 15; // minutes per slot
  const slotCount = Math.ceil(TL_TOTAL / SLOT);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDropSlot = (slotIdx: number) => {
    if (!draggingId) return;
    const newMin = TL_START + slotIdx * SLOT;
    setSuggestions((prev) =>
      prev.map((s) => (s.task_id === draggingId ? { ...s, time: toHHMM(newMin) } : s))
    );
    setDraggingId(null);
    setHoverSlot(null);
  };

  // Sort by time for display
  const sortedSugs = useMemo(
    () =>
      suggestions
        .slice()
        .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")),
    [suggestions]
  );

  const apply = async () => {
    setApplying(true);
    try {
      await Promise.all(
        suggestions
          .filter((s) => s.time)
          .map((s) =>
            updateTask(s.task_id, {
              scheduled_time: s.time,
              estimated_minutes: s.duration_minutes,
            } as any)
          )
      );
      toast.success("Horários aplicados!");
      onApplied();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setApplying(false);
    }
  };

  // ─── render helpers ────────────────────────────────────────────
  const currentTriageTask = tasksToTriage[triageIdx];
  const currentAnswers = currentTriageTask ? triageAnswers[currentTriageTask.id] || {} : {};
  const triageComplete = currentAnswers.type && currentAnswers.urgency && currentAnswers.complexity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {phase === "triage"
              ? `Triagem (${triageIdx + 1}/${tasksToTriage.length})`
              : phase === "preview"
              ? "Revise e ajuste"
              : "Sugerir ordem do dia com IA"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {/* CONFIG */}
          {phase === "config" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                A IA vai analisar suas {tasks.length} task{tasks.length !== 1 ? "s" : ""} de hoje
                {includeOverdue && overdueTasks.length > 0 ? ` + ${overdueTasks.length} atrasada${overdueTasks.length !== 1 ? "s" : ""}` : ""}
                {busy.length > 0 ? `, considerar ${busy.length} evento(s) do Google Calendar` : ""}
                {tasksToTriage.length > 0
                  ? `, e fazer ${tasksToTriage.length} pergunta(s) rápida(s) sobre tasks sem duração definida.`
                  : "."}
              </p>

              {overdueTasks.length > 0 && (
                <label
                  htmlFor="include-overdue"
                  className="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 cursor-pointer hover:bg-amber-500/10 transition-colors"
                >
                  <Checkbox
                    id="include-overdue"
                    checked={includeOverdue}
                    onCheckedChange={(v) => setIncludeOverdue(!!v)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-sm font-medium">
                        Incluir {overdueTasks.length} task{overdueTasks.length !== 1 ? "s" : ""} atrasada{overdueTasks.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Permite que a IA reorganize sua semana encaixando o que ficou para trás no plano de hoje.
                    </p>
                  </div>
                </label>
              )}

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
              <Button onClick={startTriage} disabled={effectiveTasks.length === 0} className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />
                {tasksToTriage.length > 0 ? "Começar triagem" : "Gerar sugestão"}
              </Button>
            </div>
          )}

          {/* TRIAGE */}
          {phase === "triage" && currentTriageTask && (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Task</p>
                <p className="text-sm font-medium">{currentTriageTask.title}</p>
              </div>

              <TriageGroup
                label="Que tipo de atividade é?"
                options={TYPE_OPTIONS.map((o) => o.label)}
                selected={currentAnswers.type}
                onSelect={(v) => setAnswer(currentTriageTask.id, "type", v)}
              />
              <TriageGroup
                label="Qual a urgência?"
                options={URGENCY_OPTIONS}
                selected={currentAnswers.urgency}
                onSelect={(v) => setAnswer(currentTriageTask.id, "urgency", v)}
              />
              <TriageGroup
                label="Qual a complexidade?"
                options={COMPLEXITY_OPTIONS}
                selected={currentAnswers.complexity}
                onSelect={(v) => setAnswer(currentTriageTask.id, "complexity", v)}
              />
            </div>
          )}

          {/* LOADING */}
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Organizando seu dia…</p>
            </div>
          )}

          {/* PREVIEW */}
          {phase === "preview" && (
            <div className="space-y-3">
              {summary && (
                <div className="rounded-md bg-muted/40 border border-border p-2.5 text-xs text-muted-foreground">
                  {summary}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Tasks (ajuste +/- 5min ou arraste)</p>

              <div className="space-y-1.5">
                {sortedSugs.map((s) => {
                  const t = taskMap.get(s.task_id);
                  if (!t) return null;
                  return (
                    <div
                      key={s.task_id}
                      draggable={!!s.time}
                      onDragStart={(e) => onDragStart(e, s.task_id)}
                      className={cn(
                        "flex items-center gap-2 rounded-md border border-border p-2 bg-card",
                        draggingId === s.task_id && "opacity-50"
                      )}
                    >
                      {s.time && (
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
                      )}

                      {/* Time controls */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {s.time ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => adjustTime(s.task_id, -5)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-xs font-mono font-semibold w-10 text-center tabular-nums">
                              {s.time}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => adjustTime(s.task_id, 5)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 w-[88px] justify-center">
                            <AlertCircle className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">sem horário</span>
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{s.reason}</p>
                      </div>

                      {/* Duration controls */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => adjustDuration(s.task_id, -5)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-[11px] font-mono w-12 text-center tabular-nums text-muted-foreground">
                          {s.duration_minutes}min
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => adjustDuration(s.task_id, 5)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mini-timeline drop target */}
              <div className="pt-2">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Linha do tempo (arraste para um horário)
                </p>
                <div className="rounded-md border border-border overflow-hidden">
                  {Array.from({ length: slotCount }).map((_, idx) => {
                    const slotMin = TL_START + idx * SLOT;
                    const isHour = slotMin % 60 === 0;
                    const itemsHere = suggestions.filter(
                      (s) => s.time && Math.floor((toMin(s.time) - TL_START) / SLOT) === idx
                    );
                    return (
                      <div
                        key={idx}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setHoverSlot(idx);
                        }}
                        onDragLeave={() => setHoverSlot((h) => (h === idx ? null : h))}
                        onDrop={() => onDropSlot(idx)}
                        className={cn(
                          "grid grid-cols-[50px_1fr] text-[10px] transition-colors",
                          isHour ? "border-t border-border" : "",
                          hoverSlot === idx && "bg-primary/15"
                        )}
                      >
                        <div className={cn(
                          "py-0.5 px-2 text-right border-r border-border font-mono tabular-nums",
                          isHour ? "text-foreground" : "text-muted-foreground/50"
                        )}>
                          {isHour ? toHHMM(slotMin) : ""}
                        </div>
                        <div className="py-0.5 px-2 min-h-[18px] flex items-center gap-1">
                          {itemsHere.map((s) => {
                            const t = taskMap.get(s.task_id);
                            return (
                              <span
                                key={s.task_id}
                                className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-medium truncate max-w-[200px]"
                              >
                                {t?.title}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          {phase === "triage" && (
            <>
              <Button
                variant="outline"
                onClick={() => (triageIdx === 0 ? setPhase("config") : setTriageIdx(triageIdx - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
              <Button onClick={nextTriage} disabled={!triageComplete}>
                {triageIdx < tasksToTriage.length - 1 ? (
                  <>Próxima <ChevronRight className="h-4 w-4 ml-1" /></>
                ) : (
                  <>Gerar <ArrowRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </>
          )}
          {phase === "preview" && (
            <>
              <Button variant="outline" onClick={() => setPhase("config")} disabled={applying}>
                Refazer
              </Button>
              <Button onClick={apply} disabled={applying}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirmar e aplicar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── small inline component ────────────────────────────────────
function TriageGroup({
  label, options, selected, onSelect,
}: { label: string; options: string[]; selected?: string; onSelect: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={cn(
              "px-2.5 py-1 text-xs rounded-full border transition-colors",
              selected === opt
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:bg-muted"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
