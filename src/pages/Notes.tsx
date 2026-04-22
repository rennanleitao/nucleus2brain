import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchNotes, fetchSpaces, createNote, updateNote, deleteNote, createTask, updateTask, deleteTask, fetchTasks, fetchAllTags } from "@/lib/api";
import { getBrtToday } from "@/lib/timezone";
import { supabase } from "@/integrations/supabase/client";
import { RichTextEditor, RichTextEditorHandle } from "@/components/RichTextEditor";
import { NoteAIChat } from "@/components/NoteAIChat";
import { ShareNoteDialog } from "@/components/ShareNoteDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  FileText, Plus, Trash2, Search, ArrowLeft, Tag, X, CheckSquare, ChevronDown, ChevronUp, Save, Share2, FolderInput, Copy, MoreVertical, ListTodo, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoveNoteDialog } from "@/components/MoveNoteDialog";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpaceIcon } from "@/components/SpaceIconPicker";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Notes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [notes, setNotes] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Editor state
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editSpaceId, setEditSpaceId] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveMode, setMoveMode] = useState<"move" | "replicate">("move");
  const [listCollapsed, setListCollapsed] = useState(false);
  const autosaveEnabled = true;
  const editorRef = useRef<RichTextEditorHandle>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    try {
      const [n, s] = await Promise.all([fetchNotes(), fetchSpaces()]);
      setNotes(n);
      setSpaces(s);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLinkedTasks = useCallback(async (noteId: string) => {
    if (!noteId) { setLinkedTasks([]); return; }
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, spaces(name)")
        .eq("note_id", noteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setLinkedTasks(data || []);
    } catch { setLinkedTasks([]); }
  }, []);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const noteId = searchParams.get("note");
    if (noteId && notes.length > 0 && !selectedNote) {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        selectNote(note);
        setSearchParams({}, { replace: true });
      }
    }
  }, [notes, searchParams]);

  useEffect(() => {
    if (selectedNote?.id) loadLinkedTasks(selectedNote.id);
    else setLinkedTasks([]);
  }, [selectedNote?.id, loadLinkedTasks]);

  // Autosave: debounce 2s after dirty changes
  const dirtyRef = useRef(dirty);
  const selectedNoteRef = useRef(selectedNote);
  const editTitleRef = useRef(editTitle);
  const editContentRef = useRef(editContent);
  const editTagsRef = useRef(editTags);
  const editSpaceIdRef = useRef(editSpaceId);
  dirtyRef.current = dirty;
  selectedNoteRef.current = selectedNote;
  editTitleRef.current = editTitle;
  editContentRef.current = editContent;
  editTagsRef.current = editTags;
  editSpaceIdRef.current = editSpaceId;

  useEffect(() => {
    if (!autosaveEnabled || !dirty || !selectedNote) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      if (dirtyRef.current && selectedNoteRef.current && editTitleRef.current.trim()) {
        handleSave();
      }
    }, 2000);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [dirty, editTitle, editContent, editTags, editSpaceId, autosaveEnabled, selectedNote]);

  // Autosave is always enabled - no toggle needed

  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    fetchAllTags().then(setAllTags).catch(() => {});
  }, [notes]);

  const filteredNotes = notes.filter(n => {
    const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.content || "").toLowerCase().includes(search.toLowerCase());
    const matchTag = !filterTag || (n.tags || []).includes(filterTag);
    return matchSearch && matchTag;
  });

  const selectNote = (note: any) => {
    if (dirty && selectedNote) {
      handleSave();
    }
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content || "");
    setEditTags(note.tags || []);
    setEditSpaceId(note.space_id || "");
    setDirty(false);
  };

  const handleCreateNote = async () => {
    try {
      const newNote = await createNote({ title: "Nova nota", content: "", tags: [] });
      await load();
      setSelectedNote(newNote);
      setEditTitle(newNote.title);
      setEditContent("");
      setEditTags([]);
      setEditSpaceId(newNote.space_id || "");
      setDirty(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSave = async () => {
    if (!selectedNote || !editTitle.trim()) return;
    setSaving(true);
    try {
      // Process () task patterns before saving
      const taskTitles = editorRef.current?.processTaskPatterns() || [];
      const currentContent = editorRef.current ? undefined : editContent;

      // Create tasks for each detected pattern
      for (const title of taskTitles) {
        try {
          await createTask({ title, space_id: editSpaceId || null, note_id: selectedNote.id } as any);
          toast.success(`Task criada: ${title}`);
        } catch (err: any) {
          toast.error(`Erro ao criar task "${title}": ${err.message}`);
        }
      }

      await updateNote(selectedNote.id, {
        title: editTitle.trim(),
        content: editContent,
        tags: editTags,
        space_id: editSpaceId || null,
      });
      setDirty(false);
      if (selectedNote?.id) loadLinkedTasks(selectedNote.id);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      toast.success("Nota excluída");
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleMoveOrReplicate = async (targetSpaceId: string) => {
    if (!selectedNote) return;
    const realSpaceId = targetSpaceId === "__none__" ? null : targetSpaceId;

    if (moveMode === "move") {
      try {
        await updateNote(selectedNote.id, { space_id: realSpaceId });
        setEditSpaceId(realSpaceId || "");
        setDirty(false);
        toast.success("Nota movida com sucesso");
        load();
      } catch (err: any) {
        toast.error(err.message);
      }
    } else {
      try {
        await createNote({
          title: selectedNote.title,
          content: selectedNote.content || "",
          tags: selectedNote.tags || [],
          space_id: realSpaceId,
        });
        toast.success("Nota replicada com sucesso");
        load();
      } catch (err: any) {
        toast.error(err.message);
      }
    }
  };

  const handleTagsDetected = (tags: string[]) => {
    setEditTags(prev => {
      const merged = [...new Set([...prev, ...tags])];
      const cleaned = merged.filter(t => tags.includes(t) || !prev.includes(t) === false);
      if (JSON.stringify(tags.sort()) !== JSON.stringify(prev.sort())) {
        setDirty(true);
      }
      return [...new Set([...tags])];
    });
  };

  const removeTag = (tag: string) => {
    setEditTags(prev => prev.filter(t => t !== tag));
    setDirty(true);
  };

  const stripHtml = (html: string) => {
    if (!html) return "";
    // Preserve line breaks between block-level elements before extracting text
    const withBreaks = html
      .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "$&\n")
      .replace(/<br\s*\/?>(?!\n)/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ");
    const tmp = document.createElement("div");
    tmp.innerHTML = withBreaks;
    const text = tmp.textContent || tmp.innerText || "";
    // Collapse extra whitespace but keep single newlines
    return text.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
  };

  const handleBack = () => {
    if (dirty) handleSave();
    setSelectedNote(null);
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  // On mobile, show either list or editor
  const showList = isMobile ? !selectedNote : !listCollapsed;
  const showEditor = !isMobile || !!selectedNote;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-fade-in">
      {/* Sidebar - Note list */}
      {showList && (
        <div className={`${isMobile ? "w-full" : "w-80"} border-r border-border flex flex-col bg-muted/40 flex-shrink-0`}>
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-small font-semibold flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-muted-foreground" /> Notas
                <Badge variant="secondary" className="text-[10px] ml-1">{notes.length}</Badge>
              </h2>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-10 w-10 touch-manipulation" onClick={handleCreateNote}>
                  <Plus className="h-5 w-5" />
                </Button>
                {!isMobile && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    onClick={() => setListCollapsed(true)}
                    title="Ocultar lista"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text" placeholder="Buscar notas..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary"
                />
              </div>
              {allTags.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant={filterTag ? "default" : "ghost"}
                      className="h-8 w-8 flex-shrink-0"
                      title={filterTag ? `Filtrando: #${filterTag}` : "Filtrar por tag"}
                    >
                      <Tag className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto w-56">
                    {filterTag && (
                      <DropdownMenuItem onClick={() => setFilterTag(null)} className="text-xs gap-2">
                        <X className="h-3 w-3" /> Limpar filtro
                      </DropdownMenuItem>
                    )}
                    {allTags.map(tag => (
                      <DropdownMenuItem
                        key={tag}
                        onClick={() => setFilterTag(tag)}
                        className={`text-xs ${filterTag === tag ? "bg-accent" : ""}`}
                      >
                        #{tag}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {filterTag && (
              <Badge variant="default" className="text-[10px] cursor-pointer gap-1 w-fit" onClick={() => setFilterTag(null)}>
                #{filterTag} <X className="h-2.5 w-2.5" />
              </Badge>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2.5">
              {filteredNotes.map(note => {
                const isSelected = selectedNote?.id === note.id;
                return (
                  <button
                    key={note.id}
                    onClick={() => selectNote(note)}
                    className={`group w-full text-left rounded-xl border transition-all touch-manipulation active:scale-[0.995] overflow-hidden ${
                      isSelected
                        ? "bg-card border-foreground/20 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-foreground/5"
                        : "bg-card border-border/70 hover:border-foreground/15 hover:shadow-[0_2px_8px_-3px_rgba(0,0,0,0.06)]"
                    }`}
                  >
                    <div className="px-3.5 pt-3 pb-2.5">
                      <p className="text-[13.5px] font-semibold tracking-tight text-foreground truncate leading-tight">
                        {note.title}
                      </p>
                      <p className="text-[11.5px] line-clamp-2 mt-1.5 whitespace-pre-line leading-[1.5] text-muted-foreground/90">
                        {stripHtml(note.content || "") || "Sem conteúdo"}
                      </p>
                    </div>
                    {(note.spaces?.name || (note.tags || []).length > 0) && (
                      <div className="flex items-center gap-1.5 px-3.5 py-2 border-t border-border/50 bg-muted/30 flex-wrap">
                        {note.spaces?.name && (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {note.spaces.name}
                          </span>
                        )}
                        {note.spaces?.name && (note.tags || []).length > 0 && (
                          <span className="text-[10px] text-muted-foreground/40">·</span>
                        )}
                        {(note.tags || []).slice(0, 2).map((tag: string) => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium text-muted-foreground/80 bg-background border border-border/60 rounded-md px-1.5 py-0.5"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
              {filteredNotes.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground">Nenhuma nota encontrada</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main editor area */}
      {showEditor && (
        <div className="flex-1 flex flex-col min-w-0">
          {selectedNote ? (
            <>
              <div className="p-3 sm:p-4 border-b border-border space-y-3">
                <div className="flex items-center justify-between gap-2">
                   {isMobile && (
                     <Button size="icon" variant="ghost" className="h-10 w-10 flex-shrink-0 touch-manipulation" onClick={handleBack}>
                       <ArrowLeft className="h-5 w-5" />
                    </Button>
                  )}
                  {!isMobile && listCollapsed && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setListCollapsed(false)}
                      title="Mostrar lista de notas"
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                    </Button>
                  )}
                  <input
                    type="text" value={editTitle}
                    onChange={e => { setEditTitle(e.target.value); setDirty(true); }}
                    className="flex-1 text-h1 bg-transparent outline-none placeholder:text-muted-foreground min-w-0"
                    placeholder="Título da nota"
                  />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="flex items-center gap-1.5 mr-1">
                      <Save className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Autosave ✓</span>
                    </div>
                    {dirty && (
                      <Button size="sm" onClick={handleSave} disabled={saving}
                        className="gradient-primary text-primary-foreground border-0 text-xs">
                        {saving ? "..." : "Salvar"}
                      </Button>
                    )}
                    {!dirty && autosaveEnabled && selectedNote && (
                      <span className="text-[10px] text-muted-foreground">Salvo ✓</span>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => setShareOpen(true)}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <CreateTaskDialog
                      spaces={spaces}
                      defaultSpaceId={editSpaceId || undefined}
                      defaultNoteId={selectedNote?.id || null}
                      onCreated={() => { if (selectedNote?.id) loadLinkedTasks(selectedNote.id); }}
                      trigger={
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Criar task vinculada">
                          <Plus className="h-4 w-4" />
                        </Button>
                      }
                    />
                    {linkedTasks.length > 0 && (
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary relative" title="Tasks vinculadas">
                            <ListTodo className="h-4 w-4" />
                            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center">
                              {linkedTasks.length}
                            </span>
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
                          <SheetHeader className="px-4 py-3 border-b border-border">
                            <SheetTitle className="flex items-center gap-2 text-base">
                              <CheckSquare className="h-4 w-4 text-primary" />
                              Tasks vinculadas ({linkedTasks.length})
                            </SheetTitle>
                          </SheetHeader>
                          <ScrollArea className="flex-1">
                            <div className="p-3 space-y-1">
                              {linkedTasks.map(task => (
                                <button
                                  key={task.id}
                                  onClick={() => setEditingTask(task)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-accent/50 transition-colors group border border-transparent hover:border-border"
                                >
                                  <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                                    task.status === "completed" ? "bg-primary border-primary" : "border-muted-foreground/40"
                                  }`}>
                                    {task.status === "completed" && (
                                      <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className={`text-xs flex-1 truncate ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                                    {task.title}
                                  </span>
                                  {task.due_date && (
                                    <span className={`text-[10px] flex-shrink-0 ${
                                      task.due_date < getBrtToday() ? "text-destructive" : "text-muted-foreground"
                                    }`}>
                                      {new Date(task.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                                    </span>
                                  )}
                                  {task.priority === "high" && (
                                    <span className="text-[10px] text-destructive font-medium flex-shrink-0">Alta</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        </SheetContent>
                      </Sheet>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setMoveMode("move"); setMoveDialogOpen(true); }}>
                          <FolderInput className="h-4 w-4 mr-2" />
                          Mover para outro Space
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setMoveMode("replicate"); setMoveDialogOpen(true); }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Replicar para outro Space
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(selectedNote.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir nota
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={editSpaceId || "none"} onValueChange={v => { setEditSpaceId(v === "none" ? "" : v); setDirty(true); }}>
                    <SelectTrigger className="w-auto h-7 text-xs gap-1.5 px-2">
                      <SelectValue placeholder="Sem espaço" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem espaço</SelectItem>
                      {spaces.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <SpaceIcon iconKey={s.icon} className="h-4 w-4" />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                    <Tag className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    {editTags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/20"
                        onClick={() => removeTag(tag)}>
                        #{tag} <X className="h-2.5 w-2.5" />
                      </Badge>
                    ))}
                    {editTags.length === 0 && (
                      <span className="text-[11px] text-muted-foreground">Use #tag no texto</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto flex flex-col">
                <div className="flex-1">
                  <RichTextEditor
                    ref={editorRef}
                    content={editContent}
                    onChange={(html) => { setEditContent(html); setDirty(true); }}
                    onTagsDetected={handleTagsDetected}
                    onTaskItemClick={(taskTitle) => {
                      const task = linkedTasks.find(t => t.title === taskTitle);
                      if (task) setEditingTask(task);
                    }}
                    noteId={selectedNote?.id}
                    existingTags={allTags}
                    spaceId={editSpaceId || null}
                    onTaskCreated={() => { if (selectedNote?.id) loadLinkedTasks(selectedNote.id); }}
                    placeholder="Comece a escrever... Use #tag para tags, @nota para mencionar, ()Task para criar tasks"
                    className="border-0 rounded-none min-h-full"
                    allNotes={notes.map(n => ({ id: n.id, title: n.title }))}
                    onNoteLinkClick={(noteId) => {
                      const note = notes.find(n => n.id === noteId);
                      if (note) selectNote(note);
                    }}
                    onCreateSubNote={async (title) => {
                      try {
                        const newNote = await createNote({
                          title,
                          content: "",
                          tags: [],
                          space_id: editSpaceId || null,
                        });
                        await load();
                        selectNote(newNote);
                        toast.success(`Nota "${title}" criada`);
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                  />
                </div>

                {/* AI Chat */}
                <NoteAIChat noteContent={editContent} noteTitle={editTitle} />

                {/* Linked Tasks Panel moved to a side sheet (icon in header) */}
              </div>

              {editingTask && (
                <EditTaskDialog
                  task={editingTask}
                  spaces={spaces.map(s => ({ id: s.id, name: s.name }))}
                  open={!!editingTask}
                  onOpenChange={(open) => !open && setEditingTask(null)}
                  onUpdated={() => { setEditingTask(null); if (selectedNote?.id) loadLinkedTasks(selectedNote.id); }}
                />
              )}

              {selectedNote && (
                <ShareNoteDialog
                  noteId={selectedNote.id}
                  noteTitle={editTitle}
                  open={shareOpen}
                  onOpenChange={setShareOpen}
                />
              )}

              {selectedNote && (
                <MoveNoteDialog
                  open={moveDialogOpen}
                  onOpenChange={setMoveDialogOpen}
                  mode={moveMode}
                  currentSpaceId={editSpaceId || null}
                  spaces={spaces}
                  onConfirm={handleMoveOrReplicate}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center relative">
              {!isMobile && listCollapsed && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-3 left-3 h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={() => setListCollapsed(false)}
                  title="Mostrar lista de notas"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              )}
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-small text-muted-foreground mb-3">Selecione uma nota ou crie uma nova</p>
                <Button onClick={handleCreateNote} className="gradient-primary text-primary-foreground border-0">
                  <Plus className="h-4 w-4 mr-1" /> Nova Nota
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}