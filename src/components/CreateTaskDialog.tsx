import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Tag, X, ChevronDown, LinkIcon, ExternalLink, AlertTriangle, Loader2, Sparkles, Check, FileText, CalendarClock, FolderOpen, ListChecks, Repeat, UserPlus, Send } from "lucide-react";
import { DelegateCommDialog } from "@/components/DelegateCommDialog";
import { createTask, createSpace, createSubtask, createTaskMaterial, fetchAllTags } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  TASK_EXECUTION_COMPLEXITIES,
  TaskExecutionComplexity,
  taskExecutionComplexityDurationReference,
  taskExecutionComplexityLabels,
} from "@/lib/taskComplexity";

function getBrtToday() {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return brt.toISOString().split("T")[0];
}

function getBrtTomorrow() {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  brt.setDate(brt.getDate() + 1);
  return brt.toISOString().split("T")[0];
}

function SpaceLetterAvatar({ name }: { name: string }) {
  return (
    <span className="flex items-center justify-center h-5 w-5 rounded bg-muted text-[10px] font-semibold text-foreground shrink-0 uppercase">
      {name.charAt(0)}
    </span>
  );
}

function SpaceCombobox({ spaces, spaceId, onSelect, onCreateSpace, creatingSpace }: {
  spaces: { id: string; name: string }[];
  spaceId: string;
  onSelect: (id: string) => void;
  onCreateSpace: (name: string) => Promise<void>;
  creatingSpace: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => [...spaces].sort((a, b) => a.name.localeCompare(b.name)), [spaces]);
  const filtered = sorted.filter(s => !query || s.name.toLowerCase().includes(query.toLowerCase()));
  const selected = spaces.find(s => s.id === spaceId);
  const trimmedQuery = query.trim();
  const exactMatch = trimmedQuery && sorted.some(s => s.name.toLowerCase() === trimmedQuery.toLowerCase());

  const handleCreate = async () => {
    if (!trimmedQuery || creatingSpace) return;
    await onCreateSpace(trimmedQuery);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div>
      <label className="field-label">Space</label>
      {selected ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 field-input">
            <SpaceLetterAvatar name={selected.name} />
            <span className="truncate">{selected.name}</span>
          </div>
          <button type="button" onClick={() => onSelect("")} className="text-muted-foreground hover:text-destructive shrink-0 p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar ou criar space..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 150)}
            onKeyDown={e => {
              if (e.key === "Enter" && trimmedQuery && !exactMatch) {
                e.preventDefault();
                handleCreate();
              }
            }}
            className="field-input"
          />
          {isOpen && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
              <div className="max-h-40 overflow-y-auto">
                {filtered.map(s => (
                  <button key={s.id} type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { onSelect(s.id); setIsOpen(false); setQuery(""); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left">
                    <SpaceLetterAvatar name={s.name} />
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
                {trimmedQuery && !exactMatch && (
                  <button type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={handleCreate}
                    disabled={creatingSpace}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors text-primary font-medium border-t border-border">
                    <Plus className="h-3 w-3 inline mr-1" />
                    {creatingSpace ? "Criando..." : `Criar space "${trimmedQuery}"`}
                  </button>
                )}
                {filtered.length === 0 && !trimmedQuery && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Digite para buscar ou criar</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CreateTaskDialogProps {
  spaces: { id: string; name: string }[];
  onCreated: () => void;
  defaultSpaceId?: string;
  trigger?: React.ReactNode;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultNoteId?: string | null;
  startDelegated?: boolean;
}

export function CreateTaskDialog({ spaces, onCreated, defaultSpaceId, trigger, externalOpen, onExternalOpenChange, defaultTitle = "", defaultDescription = "", defaultNoteId = null, startDelegated = false }: CreateTaskDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onExternalOpenChange?.(v);
    else setInternalOpen(v);
  };
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [executionComplexity, setExecutionComplexity] = useState<TaskExecutionComplexity>("medium");
  const [spaceId, setSpaceId] = useState<string>(defaultSpaceId || (spaces.length === 1 ? spaces[0].id : ""));
  const [dueDate, setDueDate] = useState("");
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrence, setRecurrence] = useState<"daily" | "weekly" | "monthly" | "yearly">("weekly");

  // Sync defaults when they change (e.g. dialog reopened with new selection)
  useEffect(() => {
    if (open) {
      if (defaultTitle) setTitle(defaultTitle);
      if (defaultDescription) setDescription(defaultDescription);
    }
  }, [open, defaultTitle, defaultDescription]);
  const [tag, setTag] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Subtasks state
  const [pendingSubtasks, setPendingSubtasks] = useState<{ title: string; due_date?: string }[]>([]);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskDate, setSubtaskDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");

  // Delegation state
  const [delegatedTo, setDelegatedTo] = useState("");
  const [delegatedEmail, setDelegatedEmail] = useState("");
  const [delegatedPhone, setDelegatedPhone] = useState("");
  const [showDelegation, setShowDelegation] = useState(!!startDelegated);
  const [commDialogOpen, setCommDialogOpen] = useState(false);
  const [createdTaskForComm, setCreatedTaskForComm] = useState<null | { title: string; description: string | null; due_date: string | null; delegated_to: string | null }>(null);

  useEffect(() => {
    if (open && startDelegated) setShowDelegation(true);
  }, [open, startDelegated]);


  // Materials state
  const [pendingMaterials, setPendingMaterials] = useState<{ title: string; url: string; description?: string }[]>([]);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materialDesc, setMaterialDesc] = useState("");
  const [showMaterials, setShowMaterials] = useState(false);

  // AI validation state
  const [validationState, setValidationState] = useState<"idle" | "validating" | "result">("idle");
  const [validationResult, setValidationResult] = useState<{
    is_clear: boolean;
    reason: string;
    suggested_title?: string;
    suggested_subtasks?: string[];
  } | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      fetchAllTags().then(setAllTags).catch(() => {});
    }
  }, [open]);

  // Inline space creation
  const [creatingSpace, setCreatingSpace] = useState(false);

  const handleCreateSpace = async (name: string) => {
    if (!name.trim()) return;
    setCreatingSpace(true);
    try {
      const space = await createSpace({ name: name.trim(), icon: "folder" });
      setSpaceId(space.id);
      toast.success("Space criado!");
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingSpace(false);
    }
  };

  const handleAddPendingSubtask = () => {
    if (!subtaskTitle.trim()) return;
    if (subtaskDate && dueDate && subtaskDate > dueDate) {
      toast.error("Data da subtask não pode ser posterior à data da task");
      return;
    }
    setPendingSubtasks(prev => [...prev, { title: subtaskTitle.trim(), due_date: subtaskDate || undefined }]);
    setSubtaskTitle("");
    setSubtaskDate("");
  };

  const handleRemovePendingSubtask = (idx: number) => {
    setPendingSubtasks(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddPendingMaterial = () => {
    if (!materialTitle.trim() || !materialUrl.trim()) return;
    setPendingMaterials(prev => [...prev, { title: materialTitle.trim(), url: materialUrl.trim(), description: materialDesc.trim() || undefined }]);
    setMaterialTitle("");
    setMaterialUrl("");
    setMaterialDesc("");
  };

  const handleRemovePendingMaterial = (idx: number) => {
    setPendingMaterials(prev => prev.filter((_, i) => i !== idx));
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

  const handleAcceptSuggestions = () => {
    if (!validationResult) return;
    if (validationResult.suggested_title) {
      setTitle(validationResult.suggested_title);
    }
    const subs = (validationResult.suggested_subtasks || [])
      .filter((_, i) => selectedSuggestions.has(i))
      .map(s => ({ title: s, due_date: undefined }));
    setPendingSubtasks(prev => [...prev, ...subs]);
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
    await doSaveTask();
  };

  const doSaveTask = async () => {
    setLoading(true);
    const autoStatus = dueDate ? "in_progress" : "todo";
    try {
      const task = await createTask({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        execution_complexity: executionComplexity,
        status: autoStatus,
        space_id: spaceId || null,
        due_date: dueDate || null,
        tag: tag || null,
        note_id: defaultNoteId || null,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
        recurrence: recurrenceEnabled ? recurrence : null,
        delegated_to: delegatedTo.trim() || null,
      } as any);


      if (executionComplexity !== "medium" && task && !("execution_complexity" in task)) {
        toast.warning("Task criada, mas a complexidade ainda não foi salva porque a migration do banco não foi aplicada.");
      }

      const materialsToCreate = [
        ...pendingMaterials,
        ...(materialTitle.trim() && materialUrl.trim()
          ? [{ title: materialTitle.trim(), url: materialUrl.trim(), description: materialDesc.trim() || undefined }]
          : []),
      ];

      if (pendingSubtasks.length > 0 && task?.id) {
        await Promise.all(
          pendingSubtasks.map(sub =>
            createSubtask({ task_id: task.id, title: sub.title, due_date: sub.due_date || null })
          )
        );
      }

      if (materialsToCreate.length > 0 && task?.id) {
        await Promise.all(
          materialsToCreate.map(mat =>
            createTaskMaterial({ task_id: task.id, title: mat.title, url: mat.url, description: mat.description || null })
          )
        );
      }

      toast.success("Task criada!");
      const shouldOpenComm = !!delegatedTo.trim();
      const commSnapshot = shouldOpenComm
        ? {
            title: title.trim(),
            description: description.trim() || null,
            due_date: dueDate || null,
            delegated_to: delegatedTo.trim(),
          }
        : null;
      resetForm();
      setOpen(false);
      onCreated();
      if (commSnapshot) {
        setCreatedTaskForComm(commSnapshot);
        setCommDialogOpen(true);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };


  const resetForm = () => {
    setTitle(""); setDescription(""); setPriority("medium"); setExecutionComplexity("medium"); setSpaceId(defaultSpaceId || (spaces.length === 1 ? spaces[0].id : "")); setDueDate(""); setTag(""); setTagInput(""); setEstimatedMinutes("");
    setRecurrenceEnabled(false); setRecurrence("weekly");
    setPendingSubtasks([]); setSubtaskTitle(""); setSubtaskDate("");
    setPendingMaterials([]); setMaterialTitle(""); setMaterialUrl(""); setMaterialDesc("");
    setShowMaterials(false);
    setValidationState("idle"); setValidationResult(null); setSelectedSuggestions(new Set());
  };

  const todayStr = getBrtToday();
  const tomorrowStr = getBrtTomorrow();
  const filteredTags = allTags.filter(t => !tagInput || t.toLowerCase().includes(tagInput.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" className="gradient-primary text-primary-foreground border-0">
            <Plus className="h-4 w-4 mr-1" /> New Task
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle>Criar Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Seção: Conteúdo principal */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conteúdo</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <input type="text" placeholder="Título da task" value={title} onChange={e => { setTitle(e.target.value); if (validationState !== "idle") { setValidationState("idle"); setValidationResult(null); } }}
                className="field-input flex-1" required />
              <button type="button" onClick={handleAIAnalyze} disabled={!title.trim() || validationState === "validating"}
                className="shrink-0 p-2 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-40"
                title="Analisar com IA">
                {validationState === "validating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </button>
            </div>
            <textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)}
              className="field-input h-20 resize-none" />
          </section>


          {/* Seção: Detalhamento (subtasks + materiais) */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Detalhamento</h3>
            </div>
            {/* Subtasks */}
            <div>
              <label className="field-label">Subtasks (opcional)</label>
              {pendingSubtasks.length > 0 && (
                <div className="space-y-1 mb-2 ml-2 border-l border-border pl-2">
                  {pendingSubtasks.map((sub, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate">{sub.title}</span>
                      {sub.due_date && <span className="text-muted-foreground text-[10px]">{sub.due_date}</span>}
                      <button type="button" onClick={() => handleRemovePendingSubtask(idx)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Título da subtask"
                  value={subtaskTitle}
                  onChange={e => setSubtaskTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddPendingSubtask(); } }}
                  className="field-input-sm flex-1 text-xs py-1.5"
                />
                <input
                  type="date"
                  value={subtaskDate}
                  onChange={e => setSubtaskDate(e.target.value)}
                  className="field-input-sm w-[110px] text-[10px] py-1.5 px-2"
                />
                <Button type="button" variant="ghost" size="sm" onClick={handleAddPendingSubtask} disabled={!subtaskTitle.trim()} className="h-7 px-2">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Materiais */}
            <div>
              <button type="button" onClick={() => setShowMaterials(!showMaterials)}
                className="field-label flex items-center gap-1.5 hover:text-foreground transition-colors">
                <LinkIcon className="h-3 w-3" />
                Materiais relacionados
                <ChevronDown className={`h-3 w-3 transition-transform ${showMaterials ? "rotate-180" : ""}`} />
                {pendingMaterials.length > 0 && <span className="text-[10px] text-primary">({pendingMaterials.length})</span>}
              </button>
              {showMaterials && (
                <div className="border border-border rounded-lg p-3 space-y-2 mt-1">
                  {pendingMaterials.length > 0 && (
                    <div className="space-y-1">
                      {pendingMaterials.map((mat, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs bg-muted/30 rounded p-1.5">
                          <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{mat.title}</p>
                            {mat.description && <p className="text-[10px] text-muted-foreground truncate">{mat.description}</p>}
                            <p className="text-[10px] text-muted-foreground truncate">{mat.url}</p>
                          </div>
                          <button type="button" onClick={() => handleRemovePendingMaterial(idx)} className="text-muted-foreground hover:text-destructive shrink-0">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input type="text" placeholder="Nome do material" value={materialTitle} onChange={e => setMaterialTitle(e.target.value)}
                    className="field-input-sm text-xs py-1.5" />
                  <input type="url" placeholder="https://..." value={materialUrl} onChange={e => setMaterialUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddPendingMaterial(); } }}
                    className="field-input-sm text-xs py-1.5" />
                  <input type="text" placeholder="Descrição curta (opcional)" value={materialDesc} onChange={e => setMaterialDesc(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddPendingMaterial(); } }}
                    className="field-input-sm text-xs py-1.5" />
                  <Button type="button" variant="ghost" size="sm" onClick={handleAddPendingMaterial}
                    disabled={!materialTitle.trim() || !materialUrl.trim()} className="h-7 text-xs w-full">
                    <Plus className="h-3 w-3 mr-1" /> Adicionar material
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Seção: Organização (space + tag) */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Organização</h3>
            </div>

            <SpaceCombobox
              spaces={spaces}
              spaceId={spaceId}
              onSelect={setSpaceId}
              creatingSpace={creatingSpace}
              onCreateSpace={handleCreateSpace}
            />

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
                  {showTagPicker && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                      {filteredTags.map(t => (
                        <button key={t} type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setTag(t); setTagInput(""); setShowTagPicker(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors">
                          #{t}
                        </button>
                      ))}
                      {tagInput.trim() && !allTags.some(t => t.toLowerCase() === tagInput.trim().toLowerCase().replace(/^#/, "")) && (
                        <button type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setTag(tagInput.trim().replace(/^#/, "")); setTagInput(""); setShowTagPicker(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors text-primary font-medium">
                          <Plus className="h-3 w-3 inline mr-1" />Criar tag "#{tagInput.trim().replace(/^#/, "")}"
                        </button>
                      )}
                      {filteredTags.length === 0 && !tagInput.trim() && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma tag encontrada</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Seção: Agendamento */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agendamento</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Prioridade</label>
                <select value={priority} onChange={e => setPriority(e.target.value as any)}
                  className="field-input">
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>
              <div>
                <label className="field-label">Data limite</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="field-input" />
                <div className="flex gap-1 mt-1">
                  <button type="button" onClick={() => setDueDate(todayStr)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${dueDate === todayStr ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"}`}>
                    Hoje
                  </button>
                  <button type="button" onClick={() => setDueDate(tomorrowStr)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${dueDate === tomorrowStr ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"}`}>
                    Amanhã
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {dueDate ? "Status: Em Progresso" : "Status: A Fazer"}
                </p>
              </div>
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
              <p className="text-[10px] text-muted-foreground mt-1">
                Quão difícil é iniciar esta tarefa.
              </p>
            </div>

            {/* Recurrence (optional) */}
            <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
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
                <div className="pl-6 space-y-1">
                  <label className="text-[10px] text-muted-foreground block">Frequência</label>
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
                    Ao concluir, uma nova ocorrência será criada automaticamente.
                    {!dueDate && " Defina uma data limite para ativar."}
                  </p>
                </div>
              )}
            </div>
          </section>


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

          <Button type="submit" disabled={loading || validationState === "validating"} className="w-full gradient-primary text-primary-foreground border-0">
            {loading ? "Criando..." : "Criar Task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
