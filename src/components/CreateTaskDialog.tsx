import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Tag, X, Search, ChevronDown, LinkIcon, ExternalLink, AlertTriangle, Loader2, Sparkles, Check } from "lucide-react";
import { createTask, createSpace, createSubtask, createTaskMaterial, fetchAllTags } from "@/lib/api";
import { SpaceIconPicker } from "@/components/SpaceIconPicker";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

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

function SpaceCombobox({ spaces, spaceId, onSelect, showNewSpace, setShowNewSpace, newSpaceName, setNewSpaceName, newSpaceIcon, setNewSpaceIcon, creatingSpace, onCreateSpace }: {
  spaces: { id: string; name: string }[]; spaceId: string; onSelect: (id: string) => void;
  showNewSpace: boolean; setShowNewSpace: (v: boolean) => void;
  newSpaceName: string; setNewSpaceName: (v: string) => void;
  newSpaceIcon: string; setNewSpaceIcon: (v: string) => void;
  creatingSpace: boolean; onCreateSpace: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => [...spaces].sort((a, b) => a.name.localeCompare(b.name)), [spaces]);
  const filtered = sorted.filter(s => !query || s.name.toLowerCase().includes(query.toLowerCase()));
  const selected = spaces.find(s => s.id === spaceId);

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">Space</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <button type="button" onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none hover:border-foreground/30 transition-colors text-left">
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
        <Button type="button" variant="outline" size="sm" className="shrink-0 h-auto" onClick={() => setShowNewSpace(!showNewSpace)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {showNewSpace && (
        <div className="mt-2 border border-border rounded-lg p-3 space-y-2 bg-muted/30">
          <p className="text-xs font-medium text-foreground">Novo Space</p>
          <SpaceIconPicker value={newSpaceIcon} onChange={setNewSpaceIcon} />
          <input type="text" placeholder="Nome do space" value={newSpaceName} onChange={e => setNewSpaceName(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewSpace(false)} className="flex-1">Cancelar</Button>
            <Button type="button" size="sm" disabled={creatingSpace || !newSpaceName.trim()} onClick={onCreateSpace}
              className="flex-1 gradient-primary text-primary-foreground border-0">{creatingSpace ? "Criando..." : "Criar"}</Button>
          </div>
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
}

export function CreateTaskDialog({ spaces, onCreated, defaultSpaceId, trigger, externalOpen, onExternalOpenChange, defaultTitle = "", defaultDescription = "", defaultNoteId = null }: CreateTaskDialogProps) {
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
  const [spaceId, setSpaceId] = useState<string>(defaultSpaceId || (spaces.length === 1 ? spaces[0].id : ""));
  const [dueDate, setDueDate] = useState("");

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

  // Materials state
  const [pendingMaterials, setPendingMaterials] = useState<{ title: string; url: string; description?: string }[]>([]);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materialDesc, setMaterialDesc] = useState("");
  const [showMaterials, setShowMaterials] = useState(false);

  // AI validation state
  const [validationState, setValidationState] = useState<"idle" | "validating" | "vague" | "clear">("idle");
  const [validationReason, setValidationReason] = useState("");
  const [suggestedSubtasks, setSuggestedSubtasks] = useState<string[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      fetchAllTags().then(setAllTags).catch(() => {});
    }
  }, [open]);

  // Inline space creation
  const [showNewSpace, setShowNewSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceIcon, setNewSpaceIcon] = useState("folder");
  const [creatingSpace, setCreatingSpace] = useState(false);

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return;
    setCreatingSpace(true);
    try {
      const space = await createSpace({ name: newSpaceName.trim(), icon: newSpaceIcon });
      setSpaceId(space.id);
      setNewSpaceName("");
      setNewSpaceIcon("folder");
      setShowNewSpace(false);
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

  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // If already validated as vague and user chose to save anyway, or if clear, proceed
    if (validationState === "vague" || validationState === "clear") {
      await doSaveTask();
      return;
    }

    // Validate with AI
    setValidationState("validating");
    try {
      const { data, error } = await supabase.functions.invoke("validate-task", {
        body: { title: title.trim() },
      });
      if (error || data?.error) {
        // On error, just save without validation
        await doSaveTask();
        return;
      }
      if (data.is_clear) {
        setValidationState("clear");
        await doSaveTask();
      } else {
        setValidationState("vague");
        setValidationReason(data.reason || "");
        setSuggestedSubtasks(data.suggested_subtasks || []);
        setSelectedSuggestions(new Set((data.suggested_subtasks || []).map((_: string, i: number) => i)));
      }
    } catch {
      await doSaveTask();
    }
  };

  const handleAcceptSuggestions = () => {
    const newSubs = suggestedSubtasks
      .filter((_, i) => selectedSuggestions.has(i))
      .map(s => ({ title: s, due_date: undefined }));
    setPendingSubtasks(prev => [...prev, ...newSubs]);
    setValidationState("clear");
  };

  const toggleSuggestion = (idx: number) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const doSaveTask = async () => {
    setLoading(true);
    const autoStatus = dueDate ? "in_progress" : "todo";
    try {
      const task = await createTask({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status: autoStatus,
        space_id: spaceId || null,
        due_date: dueDate || null,
        tag: tag || null,
        note_id: defaultNoteId || null,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
      } as any);

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
      resetForm();
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setPriority("medium"); setSpaceId(defaultSpaceId || (spaces.length === 1 ? spaces[0].id : "")); setDueDate(""); setTag(""); setTagInput(""); setEstimatedMinutes("");
    setPendingSubtasks([]); setSubtaskTitle(""); setSubtaskDate("");
    setPendingMaterials([]); setMaterialTitle(""); setMaterialUrl(""); setMaterialDesc("");
    setShowMaterials(false);
    setValidationState("idle"); setValidationReason(""); setSuggestedSubtasks([]); setSelectedSuggestions(new Set());
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Criar Task</DialogTitle></DialogHeader>
        <form onSubmit={validateAndSubmit} className="space-y-3">
          <input type="text" placeholder="Título da task" value={title} onChange={e => { setTitle(e.target.value); if (validationState !== "idle") setValidationState("idle"); }}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" required />
          <textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary h-20 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prioridade</label>
              <select value={priority} onChange={e => setPriority(e.target.value as any)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data limite</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
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

          {/* Tag selector */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
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
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
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

          {/* Subtasks section */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Subtasks (opcional)</label>
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
                className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"
              />
              <input
                type="date"
                value={subtaskDate}
                onChange={e => setSubtaskDate(e.target.value)}
                className="bg-background border border-border rounded px-1 py-1.5 text-[10px] outline-none focus:border-primary w-[110px]"
              />
              <Button type="button" variant="ghost" size="sm" onClick={handleAddPendingSubtask} disabled={!subtaskTitle.trim()} className="h-7 px-2">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Materials section */}
          <div>
            <button type="button" onClick={() => setShowMaterials(!showMaterials)}
              className="text-xs text-muted-foreground mb-1 flex items-center gap-1 hover:text-foreground transition-colors">
              <LinkIcon className="h-3 w-3" />
              Materiais relacionados
              <ChevronDown className={`h-3 w-3 transition-transform ${showMaterials ? "rotate-180" : ""}`} />
              {pendingMaterials.length > 0 && <span className="text-[10px] text-primary">({pendingMaterials.length})</span>}
            </button>
            {showMaterials && (
              <div className="border border-border rounded-lg p-3 space-y-2">
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
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary" />
                <input type="url" placeholder="https://..." value={materialUrl} onChange={e => setMaterialUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddPendingMaterial(); } }}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary" />
                <input type="text" placeholder="Descrição curta (opcional)" value={materialDesc} onChange={e => setMaterialDesc(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddPendingMaterial(); } }}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary" />
                <Button type="button" variant="ghost" size="sm" onClick={handleAddPendingMaterial}
                  disabled={!materialTitle.trim() || !materialUrl.trim()} className="h-7 text-xs w-full">
                  <Plus className="h-3 w-3 mr-1" /> Adicionar material
                </Button>
              </div>
            )}
          </div>

          {/* Estimated time */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tempo estimado (minutos)</label>
            <input type="number" min="1" placeholder="Ex: 30" value={estimatedMinutes} onChange={e => setEstimatedMinutes(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>

          {/* Space selector with inline creation */}
          <SpaceCombobox
            spaces={spaces}
            spaceId={spaceId}
            onSelect={setSpaceId}
            showNewSpace={showNewSpace}
            setShowNewSpace={setShowNewSpace}
            newSpaceName={newSpaceName}
            setNewSpaceName={setNewSpaceName}
            newSpaceIcon={newSpaceIcon}
            setNewSpaceIcon={setNewSpaceIcon}
            creatingSpace={creatingSpace}
            onCreateSpace={handleCreateSpace}
          />

          {/* AI Validation feedback */}
          {validationState === "validating" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analisando clareza da atividade...
            </div>
          )}

          {validationState === "vague" && (
            <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-medium text-foreground">Atividade genérica</p>
                  <p className="text-muted-foreground mt-0.5">{validationReason}</p>
                </div>
              </div>

              {suggestedSubtasks.length > 0 && (
                <div className="space-y-1.5 ml-6">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Subtasks sugeridas:</p>
                  {suggestedSubtasks.map((sub, idx) => (
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
                <Button type="button" variant="outline" size="sm" className="text-xs h-7"
                  onClick={() => { setValidationState("clear"); doSaveTask(); }}>
                  Salvar assim
                </Button>
                <Button type="button" size="sm" className="text-xs h-7 gradient-primary text-primary-foreground border-0"
                  onClick={handleAcceptSuggestions}
                  disabled={selectedSuggestions.size === 0}>
                  <Sparkles className="h-3 w-3 mr-1" /> Adicionar subtasks
                </Button>
              </div>
            </div>
          )}

          <Button type="submit" disabled={loading || validationState === "validating" || validationState === "vague"} className="w-full gradient-primary text-primary-foreground border-0">
            {loading ? "Criando..." : validationState === "validating" ? "Analisando..." : "Criar Task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}