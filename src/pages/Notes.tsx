import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchNotes, fetchSpaces, createNote, updateNote, deleteNote, createTask, updateTask, deleteTask, fetchTasks, fetchAllTags } from "@/lib/api";
import { getBrtToday } from "@/lib/timezone";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";
import { RichTextEditor, RichTextEditorHandle } from "@/components/RichTextEditor";
import { NoteAIChat } from "@/components/NoteAIChat";
import { ShareNoteDialog } from "@/components/ShareNoteDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  FileText, Plus, Trash2, Search, ArrowLeft, Tag, X, CheckSquare, ChevronDown, ChevronUp, Save, Share2, FolderInput, Copy, MoreVertical, ListTodo, PanelLeftClose, PanelLeftOpen,
  Mic, Square, Play, Download, Brain,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoveNoteDialog } from "@/components/MoveNoteDialog";
import { LinkNoteDialog } from "@/components/LinkNoteDialog";
import { NotePreviewDialog } from "@/components/NotePreviewDialog";
import { NoteTemplatesMenu } from "@/components/NoteTemplatesMenu";
import type { NoteTemplate } from "@/lib/noteTemplates";
import { NotesTimelineSidebar } from "@/components/NotesTimelineSidebar";
import { NoteDateSidebar } from "@/components/NoteDateSidebar";
import { NoteDatePicker } from "@/components/NoteDatePicker";
import { parseNoteEntries, getLastEntryDate, buildDateEntryHtml } from "@/lib/noteEntries";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpaceIcon } from "@/components/SpaceIconPicker";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface NoteAudioClip {
  id: string;
  url: string;
  blob: Blob;
  mimeType: string;
  name: string;
  durationSeconds: number;
  createdAt: string;
  transcript?: string;
}

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
  const NO_SPACE_KEY = "__none__";
  const [collapsedSpaces, setCollapsedSpaces] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("notes.collapsedSpaces");
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set();
  });
  const toggleSpaceCollapsed = (key: string) => {
    setCollapsedSpaces(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem("notes.collapsedSpaces", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

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
  const [linkNoteOpen, setLinkNoteOpen] = useState(false);
  const [previewNoteId, setPreviewNoteId] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioClips, setAudioClips] = useState<NoteAudioClip[]>([]);
  const [transcribingClipId, setTranscribingClipId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioClipsRef = useRef<NoteAudioClip[]>([]);
  const discardStoppedAudioRef = useRef(false);
  const canRecordAudio = typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);

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
    audioClipsRef.current = audioClips;
  }, [audioClips]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      audioClipsRef.current.forEach((clip) => URL.revokeObjectURL(clip.url));
    };
  }, []);

  useEffect(() => {
    if (!recordingStartedAt || !recordingAudio) return;
    const interval = window.setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - recordingStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [recordingAudio, recordingStartedAt]);

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
    const matchDate = !selectedDate || parseNoteEntries(n.content || "").some(e => e.date === selectedDate);
    return matchSearch && matchTag && matchDate;
  });

  // Group filtered notes by space, preserving `spaces` display order and
  // pushing "Sem space" to the end. Empty groups are omitted.
  const groupedNotes = useMemo(() => {
    const bySpace = new Map<string, any[]>();
    for (const n of filteredNotes) {
      const key = n.space_id || NO_SPACE_KEY;
      const list = bySpace.get(key) ?? [];
      list.push(n);
      bySpace.set(key, list);
    }
    const groups: { key: string; label: string; icon?: string; notes: any[] }[] = [];
    for (const s of spaces) {
      const list = bySpace.get(s.id);
      if (list?.length) groups.push({ key: s.id, label: s.name, icon: s.icon, notes: list });
    }
    const orphan = bySpace.get(NO_SPACE_KEY);
    if (orphan?.length) groups.push({ key: NO_SPACE_KEY, label: "Sem space", notes: orphan });
    return groups;
  }, [filteredNotes, spaces]);

  const selectNote = (note: any) => {
    if (dirty && selectedNote) {
      handleSave();
    }
    clearAudioCapture();
    setSelectedNote(note);
    setEditTitle(note.title);
    let content = note.content || "";
    // Seed today's date entry if the note has none — so every note is date-aware.
    if (!getLastEntryDate(content)) {
      content = buildDateEntryHtml(getBrtToday()) + content;
    }
    setEditContent(content);
    setEditTags(note.tags || []);
    setEditSpaceId(note.space_id || "");
    setDirty(content !== (note.content || ""));
  };

  const handleInsertDate = (date: string) => {
    if (!editorRef.current) return;
    editorRef.current.insertDateEntry(date);
    setDirty(true);
  };

  const handleJumpToDate = (date: string) => {
    editorRef.current?.scrollToEntry(date);
  };

  const handleCreateNote = async () => {
    try {
      const newNote = await createNote({ title: "Nova nota", content: "", tags: [] });
      await load();
      clearAudioCapture();
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
    clearAudioCapture();
    setSelectedNote(null);
  };

  const clearAudioCapture = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      discardStoppedAudioRef.current = true;
      mediaRecorderRef.current.stop();
    }
    audioClipsRef.current.forEach((clip) => URL.revokeObjectURL(clip.url));
    setAudioClips([]);
    setRecordingAudio(false);
    setRecordingStartedAt(null);
    setRecordingSeconds(0);
    setTranscribingClipId(null);
  };

  const startAudioCapture = useCallback(async () => {
    if (!selectedNote) {
      toast.error("Selecione ou crie uma nota antes de gravar.");
      return;
    }
    if (!canRecordAudio) {
      toast.error("Este navegador não suporta gravação de áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const startedAt = Date.now();
      const recorder = new MediaRecorder(stream);
      discardStoppedAudioRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        if (discardStoppedAudioRef.current) {
          discardStoppedAudioRef.current = false;
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const createdAt = new Date().toISOString();
          const nextClip: NoteAudioClip = {
            id: `${createdAt}-${Math.random().toString(36).slice(2)}`,
            url: URL.createObjectURL(blob),
            blob,
            mimeType: recorder.mimeType || blob.type || "audio/webm",
            name: `Áudio ${audioClipsRef.current.length + 1}`,
            durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
            createdAt,
          };
          setAudioClips((current) => [...current, nextClip]);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      setRecordingAudio(true);
      setRecordingSeconds(0);
      setRecordingStartedAt(startedAt);
      recorder.start();
      toast.success("Captura de áudio iniciada");
    } catch (err: any) {
      setRecordingAudio(false);
      setRecordingStartedAt(null);
      toast.error(err?.message || "Não foi possível iniciar a captura de áudio");
    }
  }, [canRecordAudio, selectedNote]);

  const stopAudioCapture = useCallback(() => {
    setRecordingAudio(false);
    setRecordingStartedAt(null);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    toast.success("Captura de áudio encerrada");
  }, []);

  const deleteAudioClip = (clipId: string) => {
    setAudioClips((current) => {
      const clip = current.find((item) => item.id === clipId);
      if (clip) URL.revokeObjectURL(clip.url);
      return current.filter((item) => item.id !== clipId);
    });
  };

  const transcribeAudioClip = useCallback(async (clip: NoteAudioClip) => {
    setTranscribingClipId(clip.id);
    try {
      const audioBase64 = await blobToBase64(clip.blob);
      const { data, error } = await supabase.functions.invoke("transcribe-meeting-audio", {
        body: {
          audio_base64: audioBase64,
          mime_type: clip.mimeType,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const transcript = typeof data?.transcript === "string" ? data.transcript.trim() : "";
      if (!transcript) throw new Error("A transcrição voltou vazia.");

      setAudioClips((current) => current.map((item) => (
        item.id === clip.id ? { ...item, transcript } : item
      )));
      editorRef.current?.insertHtml(buildAudioCaptureHtml(clip, transcript));
      setDirty(true);
      toast.success(`${clip.name} inserido na nota`);
    } catch (err: any) {
      toast.error(getEdgeFunctionErrorMessage(err, "Não foi possível transcrever este áudio"));
    } finally {
      setTranscribingClipId(null);
    }
  }, []);

  const handleApplyTemplate = async (template: NoteTemplate, action: "insert" | "organize") => {
    if (!selectedNote) return;
    const editor = editorRef.current;
    if (!editor) return;

    // Replace mode encoded via id suffix from menu
    const forceReplace = template.id.endsWith(":replace");
    const templateContent = template.content;

    if (action === "insert") {
      if (forceReplace || editor.isEmpty()) {
        editor.setHtml(templateContent);
      } else {
        editor.insertHtml(templateContent);
      }
      setDirty(true);
      toast.success(`Template "${template.name.replace(/:replace$/, "")}" aplicado`);
      return;
    }

    // organize: use selection if any, else full doc
    const selected = editor.getSelectionText();
    const sourceText = selected || editor.getDocText();
    if (!sourceText) {
      toast.info("Não há conteúdo para organizar");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("improve-text", {
        body: {
          text: sourceText,
          mode: "template",
          templateName: template.name,
          templateStructure: templateContent,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const html = (data?.improved || "").trim();
      if (!html) throw new Error("Resposta vazia da IA");
      if (selected) {
        editor.replaceSelectionWithHtml(html);
      } else {
        editor.setHtml(html);
      }
      setDirty(true);
      toast.success(`Conteúdo organizado com "${template.name}"`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao organizar com template");
    }
  };


  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  // On mobile, show either list or editor
  const showList = isMobile ? !selectedNote : !listCollapsed;
  const showEditor = !isMobile || !!selectedNote;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full max-w-full min-w-0 overflow-hidden animate-fade-in">
      {/* Timeline: dates across all notes */}
      {showList && !isMobile && (
        <NotesTimelineSidebar
          notes={notes}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}
      {/* Sidebar - Note list */}
      {showList && (
        <div className={`${isMobile ? "w-full" : "w-[300px]"} border-r border-border/60 flex flex-col bg-background flex-shrink-0 min-w-0 max-w-full overflow-hidden`}>
          <div className="px-5 pt-5 pb-4 border-b border-border/60 space-y-4 min-w-0">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-[22px] font-semibold leading-none tracking-tight text-foreground">
                  Notas
                </h2>
                <p className="mt-1.5 text-[11px] tracking-wide uppercase text-muted-foreground/70">
                  {notes.length} {notes.length === 1 ? "registro" : "registros"}
                </p>
              </div>
              <div className="flex items-center gap-0.5 -mb-0.5">
                {!isMobile && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setListCollapsed(true)}
                    title="Ocultar lista"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-foreground hover:bg-muted"
                  onClick={handleCreateNote}
                  title="Nova nota"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
                <input
                  type="text" placeholder="Buscar notas" value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-muted/50 border border-transparent rounded-md pl-9 pr-3 py-2 text-[12.5px] outline-none focus:bg-background focus:border-border transition-colors placeholder:text-muted-foreground/60"
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

          <div className="flex-1 w-full min-w-0 overflow-y-auto overflow-x-hidden">
            <div className="w-full min-w-0 max-w-full overflow-x-hidden px-4 py-5">
              {groupedNotes.map((group, groupIdx) => {
                const isCollapsed = collapsedSpaces.has(group.key);
                return (
                  <section key={group.key} className={`${groupIdx > 0 ? "mt-7" : ""}`}>
                    {/* Group header: sans uppercase micro + hairline rule */}
                    <button
                      type="button"
                      onClick={() => toggleSpaceCollapsed(group.key)}
                      className="w-full flex items-center gap-2 mb-2.5 group/hdr"
                    >
                      {group.icon && group.key !== NO_SPACE_KEY && (
                        <SpaceIcon iconKey={group.icon} className="h-3 w-3 text-muted-foreground/70" />
                      )}
                      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground group-hover/hdr:text-foreground transition-colors truncate">
                        {group.label}
                      </h3>
                      <span className="text-[10.5px] tabular-nums text-muted-foreground/60 font-medium">
                        {group.notes.length}
                      </span>
                      <span className="flex-1 h-px bg-border/60 ml-1" />
                      <ChevronDown className={`h-3 w-3 text-muted-foreground/50 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                    </button>

                    {!isCollapsed && (
                      <ul className="space-y-0.5">
                        {group.notes.map(note => {
                          const isSelected = selectedNote?.id === note.id;
                          const preview = stripHtml(note.content || "").replace(/\n+/g, " ");
                          return (
                            <li key={note.id}>
                              <div
                                onClick={() => selectNote(note)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === "Enter") selectNote(note); }}
                                className={`relative flex flex-col justify-center min-h-[46px] px-3 py-2 rounded-md group cursor-pointer touch-manipulation transition-colors overflow-hidden ${
                                  isSelected
                                    ? "bg-muted/70"
                                    : "hover:bg-muted/40"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`text-[13.5px] truncate leading-tight min-w-0 ${
                                      isSelected ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                                    }`}
                                  >
                                    {note.title}
                                  </span>
                                  {(note.tags || []).slice(0, 1).map((tag: string) => (
                                    <span
                                      key={tag}
                                      className="ml-auto text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground/70 shrink-0"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                                {preview && (
                                  <span className="mt-0.5 text-[11.5px] text-muted-foreground/70 truncate leading-tight font-normal">
                                    {preview}
                                  </span>
                                )}

                                <button
                                  type="button"
                                  aria-label={`Excluir nota ${note.title}`}
                                  title="Excluir nota"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Excluir a nota "${note.title}"?`)) {
                                      handleDelete(note.id);
                                    }
                                  }}
                                  className="absolute top-1/2 -translate-y-1/2 right-1.5 h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-background/80"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })}
              {filteredNotes.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-[13px] text-muted-foreground">Nenhuma nota encontrada</p>
                </div>
              )}
            </div>
          </div>
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
                    className="flex-1 text-[22px] font-semibold leading-tight tracking-tight bg-transparent outline-none placeholder:text-muted-foreground/60 min-w-0"
                    placeholder="Título da nota"
                  />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <NoteDatePicker onPick={handleInsertDate} compact />
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

              <div className="border-b border-border bg-muted/20 px-3 py-2 sm:px-4">
                <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2">
                      <Mic className={`mt-0.5 h-4 w-4 ${recordingAudio ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <p className="text-sm font-medium">
                          {recordingAudio ? `Capturando áudio ${formatDuration(recordingSeconds)}` : "Captura de áudio"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Grave a conversa e continue escrevendo na nota ao mesmo tempo.
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={recordingAudio ? "destructive" : "outline"}
                      onClick={recordingAudio ? stopAudioCapture : startAudioCapture}
                    >
                      {recordingAudio ? <Square className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
                      {recordingAudio ? "Parar" : "Gravar áudio"}
                    </Button>
                  </div>

                  {audioClips.length > 0 && (
                    <div className="space-y-2">
                      {audioClips.map((clip, index) => (
                        <div key={clip.id} className="flex flex-col gap-2 rounded-md border bg-muted/20 p-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium">{clip.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatDuration(clip.durationSeconds)} · {new Date(clip.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button variant="ghost" size="sm" className="h-8 px-2" asChild title={`Baixar ${clip.name}`}>
                                <a href={clip.url} download={`${editTitle || "nota"}-audio-${index + 1}.${getAudioExtension(clip.mimeType)}`}>
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => transcribeAudioClip(clip)}
                                disabled={transcribingClipId === clip.id}
                              >
                                <Brain className="mr-1.5 h-4 w-4" />
                                {transcribingClipId === clip.id ? "Inserindo..." : "Transcrever e inserir"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteAudioClip(clip.id)}
                                title={`Excluir ${clip.name}`}
                                aria-label={`Excluir ${clip.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <audio src={clip.url} controls className="h-8 w-full max-w-full" />
                          {clip.transcript && <AudioTranscriptPreview text={clip.transcript} compact />}
                        </div>
                      ))}
                    </div>
                  )}
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
                    toolbarExtra={
                      <NoteTemplatesMenu
                        compact
                        hasSelection={hasSelection}
                        isEmpty={!editContent || !editContent.replace(/<[^>]+>/g, "").trim()}
                        onApply={handleApplyTemplate}
                      />
                    }
                    placeholder="Comece a escrever... Use #tag para tags, @nota para mencionar, ()Task para criar tasks"
                    className="border-0 rounded-none min-h-full"
                    allNotes={notes.map(n => ({ id: n.id, title: n.title }))}
                    onLinkNote={() => setLinkNoteOpen(true)}
                    onSelectionChange={setHasSelection}
                    onNoteLinkClick={(noteId) => {
                      setPreviewNoteId(noteId);
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

              <LinkNoteDialog
                open={linkNoteOpen}
                onOpenChange={setLinkNoteOpen}
                notes={notes.map(n => ({ id: n.id, title: n.title }))}
                excludeId={selectedNote?.id}
                onSelect={(n) => {
                  editorRef.current?.insertNoteMention(n);
                  setDirty(true);
                }}
              />

              <NotePreviewDialog
                noteId={previewNoteId}
                open={!!previewNoteId}
                onOpenChange={(o) => { if (!o) setPreviewNoteId(null); }}
                onOpenFull={(id) => {
                  const n = notes.find(x => x.id === id);
                  if (n) selectNote(n);
                  load();
                }}
              />
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

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("Não foi possível preparar o áudio para transcrição"));
    reader.readAsDataURL(blob);
  });
}

function getAudioExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "m4a";
  if (normalized.includes("wav")) return "wav";
  return "webm";
}

function buildAudioCaptureHtml(clip: NoteAudioClip, transcript: string) {
  const recordedAt = new Date(clip.createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const escapedTranscript = escapeHtml(transcript).replace(/\n/g, "<br />");

  return `
    <section>
      <h2>Nota organizada por áudio - ${recordedAt}</h2>
      <p><strong>Duração:</strong> ${formatDuration(clip.durationSeconds)}</p>
      ${escapedTranscript.split("<br />").map((line) => `<p>${line}</p>`).join("")}
    </section>
  `;
}

function AudioTranscriptPreview({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-fit px-2 text-xs text-muted-foreground">
          Ver texto organizado
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className={compact ? "mt-1 max-h-28 rounded-md border bg-background p-2" : "mt-2 max-h-40 rounded-md border bg-background p-2"}>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{text}</p>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
