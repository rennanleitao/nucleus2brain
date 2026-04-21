import { useEffect, useState, useMemo } from "react";
import { usePomodoro, FocusSoundMode } from "@/hooks/usePomodoroStore";
import { fetchTasks, updateTask, fetchSpaces } from "@/lib/api";
import { Timer, Play, Pause, RotateCcw, Coffee, Zap, Repeat, Bell, BellOff, Headphones, ChevronDown, ChevronRight, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CompletionCommentDialog } from "@/components/CompletionCommentDialog";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getBrtToday } from "@/lib/timezone";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function Pomodoro() {
  const pomo = usePomodoro();
  const [tasks, setTasks] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("none");
  const [showTodayTasks, setShowTodayTasks] = useState(true);
  const [completionTask, setCompletionTask] = useState<any | null>(null);
  const [followUpTask, setFollowUpTask] = useState<any | null>(null);

  const today = getBrtToday();

  const loadTasks = () => {
    fetchTasks().then(t => {
      setTasks(t.filter((tk: any) => tk.status !== "completed" && tk.status !== "cancelled"));
    }).catch(() => {});
  };

  useEffect(() => {
    loadTasks();
    fetchSpaces().then(setSpaces).catch(() => {});
  }, []);

  const todayTasks = useMemo(() => {
    return tasks
      .filter(t => t.due_date === today)
      .sort((a, b) => {
        const aOrder = a.day_order ?? 999999;
        const bOrder = b.day_order ?? 999999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.created_at.localeCompare(b.created_at);
      });
  }, [tasks, today]);

  const handleStart = () => {
    const task = tasks.find(t => t.id === selectedTaskId);
    pomo.startFocus(task?.id, task?.title);
    toast.success("Foco iniciado! 🎯");
  };

  const handleStartWithTask = (task: any) => {
    setSelectedTaskId(task.id);
    pomo.startFocus(task.id, task.title);
    toast.success(`Foco iniciado: ${task.title} 🎯`);
  };

  const progress = pomo.totalSeconds > 0 ? ((pomo.totalSeconds - pomo.secondsLeft) / pomo.totalSeconds) * 100 : 0;

  const phaseColors = {
    idle: "text-muted-foreground",
    focus: "text-primary",
    break: "text-green-500",
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center">
        <h1 className="text-title flex items-center justify-center gap-2">
          <Timer className="h-5 w-5 text-muted-foreground" /> Pomodoro
        </h1>
        <p className="text-small text-muted-foreground mt-1">Foco profundo com técnica Pomodoro</p>
      </div>

      {/* Timer Circle */}
      <div className="flex flex-col items-center gap-6">
        <div className={`relative w-64 h-64 rounded-full border-4 ${
          pomo.phase === "focus" ? "border-primary/30" : pomo.phase === "break" ? "border-green-500/30" : "border-border"
        } flex items-center justify-center transition-colors`}>
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 256 256">
            <circle cx="128" cy="128" r="122" fill="none" strokeWidth="6"
              className={pomo.phase === "focus" ? "stroke-primary" : pomo.phase === "break" ? "stroke-green-500" : "stroke-muted"}
              strokeDasharray={`${2 * Math.PI * 122}`}
              strokeDashoffset={`${2 * Math.PI * 122 * (1 - progress / 100)}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>

          <div className="text-center z-10">
            <p className={`text-5xl font-mono font-bold ${phaseColors[pomo.phase]}`}>
              {pomo.phase === "idle" ? formatTime(pomo.focusMinutes * 60) : formatTime(pomo.secondsLeft)}
            </p>
            <p className="text-micro text-muted-foreground mt-1 uppercase tracking-wider">
              {pomo.phase === "idle" ? "Pronto" : pomo.phase === "focus" ? "Focando" : "Pausa"}
            </p>
            {pomo.taskTitle && pomo.phase === "focus" && (
              <p className="text-micro text-primary mt-1 truncate max-w-[180px]">🎯 {pomo.taskTitle}</p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {pomo.phase === "idle" ? (
            <>
              <Button onClick={handleStart} size="lg" className="gap-2">
                <Play className="h-4 w-4" /> Iniciar Foco
              </Button>
              <Button onClick={() => pomo.startBreak()} variant="outline" size="lg" className="gap-2">
                <Coffee className="h-4 w-4" /> Pausa
              </Button>
            </>
          ) : (
            <>
              {pomo.isRunning ? (
                <Button onClick={pomo.pause} variant="outline" size="lg" className="gap-2">
                  <Pause className="h-4 w-4" /> Pausar
                </Button>
              ) : (
                <Button onClick={pomo.resume} size="lg" className="gap-2">
                  <Play className="h-4 w-4" /> Retomar
                </Button>
              )}
              <Button onClick={pomo.reset} variant="ghost" size="lg" className="gap-2">
                <RotateCcw className="h-4 w-4" /> Resetar
              </Button>
            </>
          )}
        </div>

        {/* Toggles row */}
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <div className="flex items-center gap-2">
            <Headphones className={`h-3.5 w-3.5 ${pomo.focusSoundMode !== "off" ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-small text-muted-foreground">Focus Sound</span>
            <TooltipProvider>
              <Select value={pomo.focusSoundMode} onValueChange={(v) => pomo.setFocusSoundMode(v as FocusSoundMode)}>
                <SelectTrigger className="w-[140px] h-8 text-small">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="deep">Deep Focus</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="left"><p className="text-xs">15 Hz · Melhor para trabalho intenso</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="light">Light Focus</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="left"><p className="text-xs">10 Hz · Foco relaxado</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="creative">Creative</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="left"><p className="text-xs">6 Hz · Ideação e brainstorming</p></TooltipContent>
                  </Tooltip>
                  <SelectItem value="off">Desligado</SelectItem>
                </SelectContent>
              </Select>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-2">
            <Repeat className={`h-3.5 w-3.5 ${pomo.autoRepeat ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-small text-muted-foreground">Repetir</span>
            <Switch checked={pomo.autoRepeat} onCheckedChange={pomo.toggleAutoRepeat} />
          </div>

          <div className="flex items-center gap-2">
            {pomo.soundEnabled ? <Bell className="h-3.5 w-3.5 text-primary" /> : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-small text-muted-foreground">Som</span>
            <Switch checked={pomo.soundEnabled} onCheckedChange={pomo.toggleSound} />
          </div>
        </div>
      </div>

      {/* Today's Tasks from Day Planner */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <button
          onClick={() => setShowTodayTasks(!showTodayTasks)}
          className="flex items-center gap-2 w-full text-left"
        >
          {showTodayTasks ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <h2 className="text-h2">Atividades do Dia</h2>
          <span className="text-micro text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
            {todayTasks.length}
          </span>
        </button>

        {showTodayTasks && (
          todayTasks.length > 0 ? (
            <div className="space-y-2">
              {todayTasks.map(t => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                    pomo.taskId === t.id && pomo.phase === "focus"
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Checkbox
                      checked={false}
                      onCheckedChange={async () => {
                        try {
                          await updateTask(t.id, { status: "completed", completed_at: new Date().toISOString() } as any);
                          setTasks(prev => prev.filter(x => x.id !== t.id));
                          if (pomo.taskId === t.id && pomo.phase === "focus") pomo.reset();
                          setCompletionTask(t);
                        } catch {
                          toast.error("Erro ao concluir tarefa");
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-small font-medium truncate">{t.title}</p>
                      {t.estimated_minutes && (
                        <p className="text-micro text-muted-foreground">{t.estimated_minutes} min estimado</p>
                      )}
                    </div>
                  </div>
                  <button
                    className="ml-2 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors p-1"
                    onClick={() => {
                      if (pomo.taskId === t.id && pomo.phase === "focus") {
                        pomo.reset();
                      } else {
                        handleStartWithTask(t);
                      }
                    }}
                  >
                    {pomo.taskId === t.id && pomo.phase === "focus" ? (
                      <Square className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-small text-muted-foreground text-center py-4">
              Nenhuma atividade programada para hoje
            </p>
          )
        )}
      </div>

      {/* Settings */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-h2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" /> Configurações
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-micro text-muted-foreground mb-1 block">Task vinculada</label>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger className="text-small">
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {tasks.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-micro text-muted-foreground mb-1 block">Foco (min)</label>
            <Select value={String(pomo.focusMinutes)} onValueChange={v => pomo.setFocusMinutes(Number(v))}>
              <SelectTrigger className="text-small">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[15, 20, 25, 30, 45, 50, 60].map(m => (
                  <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-micro text-muted-foreground mb-1 block">Pausa (min)</label>
            <Select value={String(pomo.breakMinutes)} onValueChange={v => pomo.setBreakMinutes(Number(v))}>
              <SelectTrigger className="text-small">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 10, 15].map(m => (
                  <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-h2 mb-3">Sessões hoje</h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {Array.from({ length: Math.max(pomo.sessionsCompleted, 4) }).map((_, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-micro font-medium transition-colors ${
                  i < pomo.sessionsCompleted
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <span className="text-small text-muted-foreground">
            {pomo.sessionsCompleted} sessão{pomo.sessionsCompleted !== 1 ? "ões" : ""} completada{pomo.sessionsCompleted !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {completionTask && (
        <CompletionCommentDialog
          task={completionTask}
          open={!!completionTask}
          onOpenChange={(open) => !open && setCompletionTask(null)}
          onDone={() => { const t = completionTask; setCompletionTask(null); setFollowUpTask(t); loadTasks(); }}
        />
      )}

      {followUpTask && (
        <FollowUpDialog
          completedTask={followUpTask}
          spaces={spaces.map(s => ({ id: s.id, name: s.name }))}
          open={!!followUpTask}
          onOpenChange={(open) => !open && setFollowUpTask(null)}
          onCreated={loadTasks}
        />
      )}
    </div>
  );
}
