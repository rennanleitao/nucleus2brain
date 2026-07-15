import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateTask, fetchAllTags, fetchSubtasks, createSubtask, updateSubtask, deleteSubtask, fetchTaskLinks, deleteTaskLink, fetchTaskMaterials, createTaskMaterial, deleteTaskMaterial } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Tag, X, Search, ChevronDown, Plus, CheckCircle2, Circle, CalendarDays, Link2, LinkIcon, ExternalLink, Sparkles, Loader2, AlertTriangle, Check, Repeat, UserPlus, Send } from "lucide-react";
import { DelegateCommDialog } from "@/components/DelegateCommDialog";
import { generateNextRecurrence } from "@/lib/api";
import { LinkTaskDialog } from "@/components/LinkTaskDialog";
import { Badge } from "@/components/ui/badge";
import { getBrtToday, getBrtTomorrow } from "@/lib/timezone";
import {
  TASK_EXECUTION_COMPLEXITIES,
  TaskExecutionComplexity,
  taskExecutionComplexityDurationReference,
  taskExecutionComplexityLabels,
} from "@/lib/taskComplexity";

function SpaceLetterAvatar({ name }: { name: string }) {
  return (
    <span className="flex items-center justify-center h-5 w-5 rounded bg-muted text-[10px] font-semibold text-foreground shrink-0 uppercase">
      {name.charAt(0)}
    </span>
  );
}

function SpaceComboboxEdit({ spaces, spaceId, onSelect }: { spaces: { id: string; name: string }[]; spaceId: string; onSelect: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => [...spaces].sort((a, b) => a.name.localeCompare(b.name)), [spaces]);
  const filtered = sorted.filter(s => !query || s.name.toLowerCase().includes(query.toLowerCase()));
  const selected = spaces.find(s => s.id === spaceId);

  return (
    <div className="relative">
      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className="field-input flex items-center gap-2 text-left">
        {selected ? (<><SpaceLetterAvatar name={selected.name} /><span className="truncate">{selected.name}</span></>) : (
          <span className="text-muted-foreground">Sem space</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
      </button>
      {isOpen && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input type="text" placeholder="Buscar space..." value={query} onChange={e => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" autoFocus />
          </div>
          <div className="max-h-40 overflow-y-auto">
            <button type="button" onClick={() => { onSelect(""); setIsOpen(false); setQuery(""); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left ${!spaceId ? "bg-accent" : ""}`}>
              <span className="text-muted-foreground">Sem space</span>
            </button>
            {filtered.map(s => (
              <button key={s.id} type="button" onClick={() => { onSelect(s.id); setIsOpen(false); setQuery(""); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left ${spaceId === s.id ? "bg-accent" : ""}`}>
                <SpaceLetterAvatar name={s.name} />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
            {filtered.length === 0 && query && <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum space encontrado</p>}
          </div>
        </div>
      )}
    </div>
  );
}

interface EditTaskDialogProps {
  task: {
    id: string;
    title: string;
    description?: string | null;
    priority: "low" | "medium" | "high";
    status: "todo" | "in_progress" | "waiting" | "completed" | "cancelled";
    due_date?: string | null;
    space_id?: string | null;
    tag?: string | null;
    execution_complexity?: TaskExecutionComplexity | null;
    estimated_minutes?: number | null;
    recurrence?: "daily" | "weekly" | "monthly" | "yearly" | null;
    delegated_to?: string | null;
  };
  spaces: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditTaskDialog({ task, spaces, open, onOpenChange, onUpdated }: EditTaskDialogProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [executionComplexity, setExecutionComplexity] = useState<TaskExecutionComplexity>(task.execution_complexity || "medium");
  const [status, setStatus] = useState(task.status);
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const [spaceId, setSpaceId] = useState(task.space_id || "");
  const [tag, setTag] = useState(task.tag || "");
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [existingReminder, setExistingReminder] = useState<any>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimated_minutes?.toString() || "");
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(!!task.recurrence);
  const [recurrence, setRecurrence] = useState<"daily" | "weekly" | "monthly" | "yearly">(task.recurrence || "weekly");
  const [delegatedTo, setDelegatedTo] = useState(task.delegated_to || "");
  const [delegatedEmail, setDelegatedEmail] = useState("");
  const [delegatedPhone, setDelegatedPhone] = useState("");
  const [showDelegation, setShowDelegation] = useState(!!task.delegated_to);
  const [commDialogOpen, setCommDialogOpen] = useState(false);


  // Subtasks state
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDate, setNewSubtaskDate] = useState("");

  // Linked tasks state
  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // Materials state
  const [materials, setMaterials] = useState<any[]>([]);
  const [newMatTitle, setNewMatTitle] = useState("");
  const [newMatUrl, setNewMatUrl] = useState("");
  const [newMatDesc, setNewMatDesc] = useState("");

  // AI validation state
  const [validationState, setValidationState] = useState<"idle" | "validating" | "result">("idle");
  const [validationResult, setValidationResult] = useState<{
    is_clear: boolean;
    reason: string;
    suggested_title?: string;
    suggested_subtasks?: string[];
  } | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  const loadLinkedTasks = () => {
    fetchTaskLinks(task.id).then(setLinkedTasks).catch(() => {});
  };

  const loadMaterials = () => {
    fetchTaskMaterials(task.id).then(setMaterials).catch(() => {});
  };

  useEffect(() => {
    if (open) {
      fetchAllTags().then(setAllTags).catch(() => {});
      fetchSubtasks(task.id).then(setSubtasks).catch(() => {});
      loadLinkedTasks();
      loadMaterials();
    }
  }, [open, task.id]);

  useEffect(() => {
    const loadReminder = async () => {
      const { data } = await supabase
        .from("reminders")
        .select("*")
        .eq("task_id", task.id)
        .eq("sent", false)
        .maybeSingle();
      if (data) {
        setExistingReminder(data);
        const dt = new Date(data.reminder_time);
        setReminderDate(dt.toISOString().split("T")[0]);
        setReminderTime(dt.toTimeString().slice(0, 5));
      }
    };
    loadReminder();
  }, [task.id]);

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    if (newSubtaskDate && dueDate && newSubtaskDate > dueDate) {
      toast.error("Data da subtask não pode ser posterior à data da task");
      return;
    }
    try {
      await createSubtask({ task_id: task.id, title: newSubtaskTitle.trim(), due_date: newSubtaskDate || null });
      const updated = await fetchSubtasks(task.id);
      setSubtasks(updated);
      setNewSubtaskTitle("");
      setNewSubtaskDate("");
      toast.success("Subtask adicionada");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleSubtask = async (subId: string) => {
    const sub = subtasks.find(s => s.id === subId);
    if (!sub) return;
    const newStatus = sub.status === "completed" ? "todo" : "completed";
    try {
      await updateSubtask(subId, { status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null });
      const updated = await fetchSubtasks(task.id);
      setSubtasks(updated);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteSubtask = async (subId: string) => {
    try {
      await deleteSubtask(subId);
      setSubtasks(prev => prev.filter(s => s.id !== subId));
      toast.success("Subtask removida");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddMaterial = async () => {
    if (!newMatTitle.trim() || !newMatUrl.trim()) return;
    try {
      await createTaskMaterial({ task_id: task.id, title: newMatTitle.trim(), url: newMatUrl.trim(), description: newMatDesc.trim() || null });
      await loadMaterials();
      setNewMatTitle(""); setNewMatUrl(""); setNewMatDesc("");
      toast.success("Material adicionado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAIAnalyze = async () => {
    if (!title.trim()) return;
    setValidationState("validating");
    try {
      const { data, error } = await supabase.functions.invoke("validate-task", {
        body: { title: title.trim() },
      });
      if (error || data?.error) {
        toast.error("Não foi possível analisar a tarefa");
        setValidationState("idle");
        return;
      }
      setValidationResult(data);
      if (!data.is_clear && data.suggested_subtasks) {
        setSelectedSuggestions(new Set(data.suggested_subtasks.map((_: string, i: number) => i)));
      }
      setValidationState("result");
    } catch {
      toast.error("Erro ao analisar tarefa");
      setValidationState("idle");
    }
  };

  const handleAcceptSuggestions = async () => {
    if (!validationResult) return;
    if (validationResult.suggested_title) {
      setTitle(validationResult.suggested_title);
    }
    const subs = (validationResult.suggested_subtasks || [])
      .filter((_, i) => selectedSuggestions.has(i));
    for (const sub of subs) {
      try {
        await createSubtask({ task_id: task.id, title: sub, due_date: null });
      } catch {}
    }
    if (subs.length > 0) {
      const updated = await fetchSubtasks(task.id);
      setSubtasks(updated);
      toast.success(`${subs.length} subtask(s) adicionada(s)`);
    }
    setValidationState("idle");
    setValidationResult(null);
  };

  const handleAcceptTitleOnly = () => {
    if (validationResult?.suggested_title) {
      setTitle(validationResult.suggested_title);
    }
    setValidationState("idle");
    setValidationResult(null);
  };

  const toggleSuggestion = (idx: number) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const prevStatus = task.status;
      const updatedTask = await updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        execution_complexity: executionComplexity,
        status,
        due_date: dueDate || null,
        space_id: spaceId || null,
        completed_at: status === "completed" ? new Date().toISOString() : null,
        tag: tag || null,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
        recurrence: recurrenceEnabled ? recurrence : null,
        delegated_to: delegatedTo.trim() || null,
      } as any);

      if (executionComplexity !== "medium" && updatedTask && !("execution_complexity" in updatedTask)) {
        toast.warning("Task atualizada, mas a complexidade ainda não foi salva porque a migration do banco não foi aplicada.");
      }

      // If the task transitioned to completed/cancelled and is recurrent, spawn next occurrence
      const becameTerminal = (status === "completed" || status === "cancelled") && prevStatus !== status;
      if (becameTerminal && recurrenceEnabled && dueDate) {
        try {
          const next = await generateNextRecurrence(task.id);
          if (next) toast.success(`Próxima ocorrência criada para ${next.due_date}`);
        } catch (err) {
          console.error("recurrence generation failed", err);
        }
      }

      if (newMatTitle.trim() && newMatUrl.trim()) {
        await createTaskMaterial({
          task_id: task.id,
          title: newMatTitle.trim(),
          url: newMatUrl.trim(),
          description: newMatDesc.trim() || null,
        });
        setNewMatTitle("");
        setNewMatUrl("");
        setNewMatDesc("");
      }

      if (reminderDate && reminderTime) {
        const reminderDatetime = new Date(`${reminderDate}T${reminderTime}`).toISOString();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (existingReminder) {
            await supabase.from("reminders").update({ reminder_time: reminderDatetime }).eq("id", existingReminder.id);
          } else {
            await supabase.from("reminders").insert({
              user_id: user.id,
              task_id: task.id,
              reminder_time: reminderDatetime,
            });
          }
        }
      } else if (existingReminder && !reminderDate) {
        await supabase.from("reminders").delete().eq("id", existingReminder.id);
      }

      toast.success("Task atualizada!");
      onOpenChange(false);
      onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const todayStr = getBrtToday();
  const tomorrowStr = getBrtTomorrow();
  const filteredTags = allTags.filter(t => !tagInput || t.toLowerCase().includes(tagInput.toLowerCase()));

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-background p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base font-semibold tracking-tight">Editar Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="field-label">Título</label>
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Título da task" value={title} onChange={e => setTitle(e.target.value)}
                className="field-input flex-1" required />
              <button type="button" onClick={handleAIAnalyze} disabled={!title.trim() || validationState === "validating"}
                className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary shadow-sm transition-colors disabled:opacity-40"
                title="Analisar com IA">
                {validationState === "validating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="field-label">Descrição</label>
            <textarea placeholder="Adicione contexto..." value={description} onChange={e => setDescription(e.target.value)}
              className="field-input h-20 resize-none" />
          </div>
          {/* AI Validation feedback */}
          {validationState === "validating" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analisando clareza da atividade...
            </div>
          )}

          {validationState === "result" && validationResult && (
            <div className={`border rounded-lg p-3 space-y-2 ${validationResult.is_clear ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
              <div className="flex items-start gap-2">
                {validationResult.is_clear ? (
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                )}
                <div className="text-xs">
                  <p className="font-medium text-foreground">
                    {validationResult.is_clear ? "Atividade clara ✓" : "Atividade pode ser mais específica"}
                  </p>
                  <p className="text-muted-foreground mt-0.5">{validationResult.reason}</p>
                </div>
                <button type="button" onClick={() => { setValidationState("idle"); setValidationResult(null); }}
                  className="ml-auto text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {!validationResult.is_clear && (
                <>
                  {validationResult.suggested_title && (
                    <div className="ml-6 space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Título sugerido:</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs bg-accent/50 rounded px-2 py-1 flex-1">"{validationResult.suggested_title}"</p>
                        <button type="button" onClick={handleAcceptTitleOnly}
                          className="text-[10px] text-primary hover:underline shrink-0">Usar</button>
                      </div>
                    </div>
                  )}

                  {validationResult.suggested_subtasks && validationResult.suggested_subtasks.length > 0 && (
                    <div className="space-y-1.5 ml-6">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Subtasks sugeridas:</p>
                      {validationResult.suggested_subtasks.map((sub, idx) => (
                        <label key={idx} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5 transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedSuggestions.has(idx)}
                            onChange={() => toggleSuggestion(idx)}
                            className="rounded border-border"
                          />
                          <span>{sub}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 ml-6 mt-2">
                    <Button type="button" size="sm" className="text-xs h-7 gradient-primary text-primary-foreground border-0"
                      onClick={handleAcceptSuggestions}
                      disabled={selectedSuggestions.size === 0 && !validationResult.suggested_title}>
                      <Sparkles className="h-3 w-3 mr-1" /> Aplicar sugestões
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Prioridade</label>
              <select value={priority} onChange={e => setPriority(e.target.value as any)}
                className="field-input">
                <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option>
              </select>
            </div>
            <div>
              <label className="field-label">Complexidade de Execução</label>
              <select value={executionComplexity} onChange={e => setExecutionComplexity(e.target.value as TaskExecutionComplexity)}
                className="field-input">
                {TASK_EXECUTION_COMPLEXITIES.map(level => (
                  <option key={level} value={level}>
                    {taskExecutionComplexityLabels[level]} - {taskExecutionComplexityDurationReference[level]}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">Dificuldade para iniciar.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)}
                className="field-input">
                <option value="todo">A Fazer</option><option value="in_progress">Em Progresso</option>
                <option value="waiting">Aguardando</option><option value="completed">Concluída</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
            <div>
              <label className="field-label">Space</label>
              <SpaceComboboxEdit spaces={spaces} spaceId={spaceId} onSelect={setSpaceId} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Data limite</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="field-input" />
              <div className="flex gap-1.5 mt-1.5">
                <button type="button" onClick={() => setDueDate(todayStr)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${dueDate === todayStr ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"}`}>
                  Hoje
                </button>
                <button type="button" onClick={() => setDueDate(tomorrowStr)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${dueDate === tomorrowStr ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"}`}>
                  Amanhã
                </button>
              </div>
            </div>
          </div>

          {/* Recurrence (optional) */}
          <div className="field-section">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={recurrenceEnabled}
                onChange={e => setRecurrenceEnabled(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
              Tarefa recorrente
            </label>
            {recurrenceEnabled && (
              <div className="pl-6 space-y-1.5">
                <label className="field-label !mb-0">Frequência</label>
                <select
                  value={recurrence}
                  onChange={e => setRecurrence(e.target.value as any)}
                  className="field-input"
                >
                  <option value="daily">Todos os dias</option>
                  <option value="weekly">Toda semana</option>
                  <option value="monthly">Todo mês</option>
                  <option value="yearly">Todo ano</option>
                </select>
                <p className="text-[10px] text-muted-foreground pt-0.5">
                  Ao concluir ou cancelar, a próxima ocorrência é criada automaticamente.
                  {!dueDate && " Defina uma data limite para ativar."}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="field-label flex items-center gap-1.5">
              <Tag className="h-3 w-3" /> Tag (opcional)
            </label>
            {tag ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">#{tag}</Badge>
                <button type="button" onClick={() => setTag("")} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar ou criar tag..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onFocus={() => setShowTagPicker(true)}
                  onBlur={() => setTimeout(() => setShowTagPicker(false), 150)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      setTag(tagInput.trim().replace(/^#/, ""));
                      setTagInput("");
                      setShowTagPicker(false);
                    }
                  }}
                  className="field-input"
                />
                {showTagPicker && filteredTags.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                    {filteredTags.map(t => (
                      <button key={t} type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setTag(t); setTagInput(""); setShowTagPicker(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors">
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delegação */}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <button type="button" onClick={() => setShowDelegation(v => !v)}
              className="w-full flex items-center gap-2 text-left">
              <UserPlus className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium flex-1">Delegar para outra pessoa</span>
              {delegatedTo.trim() && !showDelegation && (
                <span className="text-[10px] text-primary font-medium truncate max-w-[120px]">{delegatedTo}</span>
              )}
              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${showDelegation ? "rotate-180" : ""}`} />
            </button>
            {showDelegation && (
              <div className="space-y-2">
                <input type="text" placeholder="Nome do responsável" value={delegatedTo}
                  onChange={e => setDelegatedTo(e.target.value)} className="field-input-sm text-xs py-1.5" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="email" placeholder="E-mail" value={delegatedEmail}
                    onChange={e => setDelegatedEmail(e.target.value)} className="field-input-sm text-xs py-1.5" />
                  <input type="tel" placeholder="WhatsApp" value={delegatedPhone}
                    onChange={e => setDelegatedPhone(e.target.value)} className="field-input-sm text-xs py-1.5" />
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setCommDialogOpen(true)}
                  disabled={!delegatedTo.trim()} className="h-7 text-xs w-full">
                  <Send className="h-3 w-3 mr-1" /> Enviar comunicação
                </Button>
              </div>
            )}
          </div>

          {/* Subtasks */}

          <div className="border border-border rounded-lg p-3 space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Subtasks</label>
            {subtasks.length > 0 && (
              <div className="space-y-1 ml-1 border-l border-border pl-2">
                {subtasks.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 py-0.5">
                    <button type="button" onClick={() => handleToggleSubtask(sub.id)}
                      className={`flex-shrink-0 transition-colors ${sub.status === "completed" ? "text-muted-foreground" : "text-muted-foreground hover:text-primary"}`}>
                      {sub.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    </button>
                    <span className={`text-xs flex-1 truncate ${sub.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                      {sub.title}
                    </span>
                    {sub.due_date && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <CalendarDays className="h-2.5 w-2.5" />
                        {sub.due_date}
                      </span>
                    )}
                    <button type="button" onClick={() => handleDeleteSubtask(sub.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nova subtask..."
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddSubtask(); } }}
                className="field-input-sm flex-1 text-xs py-1.5"
              />
              <input
                type="date"
                value={newSubtaskDate}
                onChange={e => setNewSubtaskDate(e.target.value)}
                className="field-input-sm w-[110px] text-[10px] py-1.5 px-2"
              />
              <Button type="button" variant="ghost" size="sm" onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()} className="h-7 px-2">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Linked Tasks */}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Tasks Vinculadas
              </label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowLinkDialog(true)} className="h-6 px-2 text-[10px]">
                <Plus className="h-3 w-3 mr-1" /> Vincular
              </Button>
            </div>
            {linkedTasks.length > 0 ? (
              <div className="space-y-1 ml-1">
                {linkedTasks.map((link: any) => {
                  const lt = link.linked_task;
                  if (!lt) return null;
                  return (
                    <div key={link.id} className="flex items-center gap-2 py-0.5">
                      <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs flex-1 truncate">{lt.title}</span>
                      {lt.spaces?.name && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{lt.spaces.name}</span>
                      )}
                      <button type="button" onClick={async () => {
                        try {
                          await deleteTaskLink(link.id);
                          loadLinkedTasks();
                          toast.success("Vínculo removido");
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">Nenhuma task vinculada</p>
            )}
          </div>

          <LinkTaskDialog
            open={showLinkDialog}
            onOpenChange={setShowLinkDialog}
            currentTaskId={task.id}
            currentTaskTitle={task.title}
            spaces={spaces}
            onLinked={() => {
              loadLinkedTasks();
              fetchSubtasks(task.id).then(setSubtasks).catch(() => {});
              onUpdated();
            }}
          />

          {/* Estimated time */}
          <div>
            <label className="field-label">Tempo estimado (minutos)</label>
            <input type="number" min="1" placeholder="Ex: 30" value={estimatedMinutes} onChange={e => setEstimatedMinutes(e.target.value)}
              className="field-input" />
          </div>

          {/* Materials */}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <LinkIcon className="h-3 w-3" /> Materiais Relacionados
            </label>
            {materials.length > 0 && (
              <div className="space-y-1">
                {materials.map((mat: any) => (
                  <div key={mat.id} className="flex items-start gap-2 text-xs bg-muted/30 rounded p-1.5">
                    <a href={mat.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 shrink-0 text-primary hover:text-primary/80">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a href={mat.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 hover:underline">
                      <p className="font-medium truncate">{mat.title}</p>
                      {mat.description && <p className="text-[10px] text-muted-foreground truncate">{mat.description}</p>}
                    </a>
                    <button type="button" onClick={async () => {
                      try { await deleteTaskMaterial(mat.id); loadMaterials(); toast.success("Material removido"); }
                      catch (err: any) { toast.error(err.message); }
                    }} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input type="text" placeholder="Nome do material" value={newMatTitle} onChange={e => setNewMatTitle(e.target.value)}
              className="field-input-sm text-xs py-1.5" />
            <input type="url" placeholder="https://..." value={newMatUrl} onChange={e => setNewMatUrl(e.target.value)}
              className="field-input-sm text-xs py-1.5" />
            <input type="text" placeholder="Descrição curta (opcional)" value={newMatDesc} onChange={e => setNewMatDesc(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddMaterial(); } }}
              className="field-input-sm text-xs py-1.5" />
            <Button type="button" variant="ghost" size="sm" onClick={handleAddMaterial}
              disabled={!newMatTitle.trim() || !newMatUrl.trim()} className="h-7 text-xs w-full">
              <Plus className="h-3 w-3 mr-1" /> Adicionar material
            </Button>
          </div>

          {/* Reminder */}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Bell className="h-3 w-3" /> Lembrete
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)}
                className="field-input-sm text-xs py-1.5" />
              <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                className="field-input-sm text-xs py-1.5" />
            </div>
            {existingReminder && (
              <button type="button" onClick={() => { setReminderDate(""); setReminderTime(""); }}
                className="text-[10px] text-destructive hover:underline">
                Remover lembrete
              </button>
            )}
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    <DelegateCommDialog
      open={commDialogOpen}
      onOpenChange={setCommDialogOpen}
      task={{
        title: title.trim() || task.title,
        description: description.trim() || null,
        due_date: dueDate || null,
        delegated_to: delegatedTo.trim() || null,
      }}
      defaultEmail={delegatedEmail}
      defaultPhone={delegatedPhone}
    />
    </>
  );
}

