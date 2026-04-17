import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchSpace, fetchTasksBySpace, fetchNotesBySpace, fetchLinksBySpace,
  fetchAttachments, uploadAttachment, deleteAttachment, getAttachmentUrl,
  createTask, createNote, createLink, deleteLink, updateTask, updateNote, deleteTask, deleteNote,
} from "@/lib/api";
import { TaskCard } from "@/components/TaskCard";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { EditSpaceDialog } from "@/components/EditSpaceDialog";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import { CompletionCommentDialog } from "@/components/CompletionCommentDialog";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ShareSpaceDialog } from "@/components/ShareSpaceDialog";
import { ShareNoteDialog } from "@/components/ShareNoteDialog";
import { NoteAIChat } from "@/components/NoteAIChat";
import { SpaceIcon } from "@/components/SpaceIconPicker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, CheckSquare, FileText, Link2, Paperclip, Plus, Trash2, ExternalLink, Upload, X, Tag, ArrowLeftIcon, Pencil, Users, Save, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function SpaceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [space, setSpace] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [followUpTask, setFollowUpTask] = useState<any>(null);
  const [completionTask, setCompletionTask] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [editSpaceOpen, setEditSpaceOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareNoteOpen, setShareNoteOpen] = useState(false);

  // Note editor state
  const [editNoteTitle, setEditNoteTitle] = useState("");
  const [editNoteContent, setEditNoteContent] = useState("");
  const [editNoteTags, setEditNoteTags] = useState<string[]>([]);
  const [noteDirty, setNoteDirty] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Link creation
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDesc, setLinkDesc] = useState("");


  const load = async () => {
    if (!id) return;
    try {
      const [s, t, n, l, a] = await Promise.all([
        fetchSpace(id), fetchTasksBySpace(id), fetchNotesBySpace(id),
        fetchLinksBySpace(id), fetchAttachments(id),
      ]);
      setSpace(s); setTasks(t); setNotes(n); setLinks(l); setAttachments(a);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === "completed" ? "todo" : "completed";
    try {
      await updateTask(taskId, { status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null });
      if (newStatus === "completed") {
        setCompletionTask(task);
      }
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDeleteTask = async (taskId: string) => {
    try { await deleteTask(taskId); toast.success("Task excluída"); load(); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleDeleteNote = async (noteId: string) => {
    try { await deleteNote(noteId); toast.success("Nota excluída"); load(); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !id) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadAttachment(id, file);
      }
      toast.success("Arquivo(s) enviado(s)!");
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleDeleteAttachment = async (att: any) => {
    try { await deleteAttachment(att.id, att.file_path); toast.success("Anexo excluído"); load(); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    try {
      await createLink({ title: linkTitle.trim(), url: linkUrl.trim(), description: linkDesc.trim() || null, space_id: id! });
      toast.success("Link adicionado!");
      setLinkTitle(""); setLinkUrl(""); setLinkDesc(""); setLinkDialogOpen(false);
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const openNoteEditor = (note: any) => {
    setSelectedNote(note);
    setEditNoteTitle(note.title);
    setEditNoteContent(note.content || "");
    setEditNoteTags(note.tags || []);
    setNoteDirty(false);
  };

  const handleCreateNewNote = async () => {
    try {
      const newNote = await createNote({ title: "Nova nota", content: "", tags: [], space_id: id! });
      await load();
      openNoteEditor(newNote);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSaveNote = useCallback(async () => {
    if (!selectedNote || !editNoteTitle.trim() || noteSaving) return;
    setNoteSaving(true);
    try {
      await updateNote(selectedNote.id, {
        title: editNoteTitle.trim(),
        content: editNoteContent,
        tags: editNoteTags,
      });
      setNoteDirty(false);
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setNoteSaving(false); }
  }, [selectedNote, editNoteTitle, editNoteContent, editNoteTags, noteSaving]);

  // Autosave with debounce
  useEffect(() => {
    if (!noteDirty || !selectedNote) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => handleSaveNote(), 3000);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [editNoteContent, editNoteTitle, editNoteTags, noteDirty]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  if (!space) {
    return <div className="p-6 text-center"><p className="text-muted-foreground">Space não encontrado</p></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/spaces")} className="flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <SpaceIcon iconKey={space.icon} className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="text-title">{space.name}</h1>
            {space.description && <p className="text-small text-muted-foreground">{space.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShareOpen(true)}>
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setEditSpaceOpen(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {editSpaceOpen && (
        <EditSpaceDialog
          space={space}
          open={editSpaceOpen}
          onOpenChange={setEditSpaceOpen}
          onUpdated={load}
          onDeleted={() => navigate("/spaces")}
        />
      )}

      <ShareSpaceDialog
        spaceId={space.id}
        spaceName={space.name}
        isOwner={user?.id === space.user_id}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="secondary">{tasks.filter(t => t.status !== "completed").length} tarefas ativas</Badge>
        <Badge variant="secondary">{notes.length} notas</Badge>
        <Badge variant="secondary">{links.length} links</Badge>
        <Badge variant="secondary">{attachments.length} anexos</Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="tasks" className="text-xs gap-1"><CheckSquare className="h-3 w-3" /> Tasks</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs gap-1"><FileText className="h-3 w-3" /> Notas</TabsTrigger>
          <TabsTrigger value="links" className="text-xs gap-1"><Link2 className="h-3 w-3" /> Links</TabsTrigger>
          <TabsTrigger value="attachments" className="text-xs gap-1"><Paperclip className="h-3 w-3" /> Anexos</TabsTrigger>
        </TabsList>

        {/* TASKS TAB */}
        <TabsContent value="tasks" className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-small font-semibold">Tasks</h3>
              <CreateTaskDialog spaces={[{ id: space.id, name: space.name }]} onCreated={load} />
            </div>
            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map(t => (
                  <div key={t.id} onClick={() => setEditingTask(t)} className="cursor-pointer">
                    <TaskCard task={t} onToggle={() => toggleTask(t.id)} onDelete={() => handleDeleteTask(t.id)} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-small text-muted-foreground">Nenhuma tarefa neste espaço</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* NOTES TAB */}
        <TabsContent value="notes" className="space-y-3">
          {selectedNote ? (
            /* Inline rich editor - identical to Notes page */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={() => { if (noteDirty) handleSaveNote(); setSelectedNote(null); }}>
                  <ArrowLeftIcon className="h-4 w-4 mr-1" /> Voltar
                </Button>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="flex items-center gap-1.5 mr-1">
                    <Save className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Autosave ✓</span>
                  </div>
                  {noteDirty && (
                    <Button size="sm" onClick={handleSaveNote} disabled={noteSaving}
                      className="gradient-primary text-primary-foreground border-0 text-xs">
                      {noteSaving ? "..." : "Salvar"}
                    </Button>
                  )}
                  {!noteDirty && selectedNote && (
                    <span className="text-[10px] text-muted-foreground">Salvo ✓</span>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => setShareNoteOpen(true)}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => { handleDeleteNote(selectedNote.id); setSelectedNote(null); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <input type="text" value={editNoteTitle}
                onChange={e => { setEditNoteTitle(e.target.value); setNoteDirty(true); }}
                className="w-full text-h1 bg-transparent outline-none placeholder:text-muted-foreground"
                placeholder="Título da nota" />
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className="h-3 w-3 text-muted-foreground" />
                {editNoteTags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/20"
                    onClick={() => { setEditNoteTags(prev => prev.filter(t => t !== tag)); setNoteDirty(true); }}>
                    #{tag} <X className="h-2.5 w-2.5" />
                  </Badge>
                ))}
                {editNoteTags.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">Use #tag no texto para criar tags</span>
                )}
              </div>
              <RichTextEditor
                content={editNoteContent}
                onChange={(html) => { setEditNoteContent(html); setNoteDirty(true); }}
                onTagsDetected={(tags) => {
                  setEditNoteTags(prev => {
                    if (JSON.stringify(tags.sort()) !== JSON.stringify([...prev].sort())) {
                      setNoteDirty(true);
                    }
                    return [...new Set([...tags])];
                  });
                }}
                noteId={selectedNote?.id}
                existingTags={[...new Set(notes.flatMap((n: any) => n.tags || []))]}
                spaceId={id || null}
                placeholder="Comece a escrever... Use #tag para tags, ()Task para criar tasks ao salvar"
              />

              {/* AI Chat */}
              <NoteAIChat noteContent={editNoteContent} noteTitle={editNoteTitle} />

              {selectedNote && (
                <ShareNoteDialog
                  noteId={selectedNote.id}
                  noteTitle={editNoteTitle}
                  open={shareNoteOpen}
                  onOpenChange={setShareNoteOpen}
                />
              )}
            </div>
          ) : (
            /* Note list */
            <>
              <div className="flex justify-end">
                <Button size="sm" className="gradient-primary text-primary-foreground border-0" onClick={handleCreateNewNote}>
                  <Plus className="h-4 w-4 mr-1" /> Nova Nota
                </Button>
              </div>
              {notes.length > 0 ? (
                <div className="space-y-2">
                  {[...notes].sort((a, b) => a.title.localeCompare(b.title)).map(note => (
                    <button
                      key={note.id}
                      onClick={() => openNoteEditor(note)}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border border-border bg-card hover:shadow-sm transition-all text-left animate-fade-in touch-manipulation active:scale-[0.99] group"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-small font-medium truncate">{note.title}</h3>
                        <p className="text-micro text-muted-foreground truncate mt-0.5">{stripHtml(note.content || "Sem conteúdo")}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {(note.tags || []).slice(0, 2).map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0">#{tag}</Badge>
                        ))}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma nota neste espaço</p>
                </div>
              )}
            </>
          )}
        </TabsContent>
        <TabsContent value="links" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-primary text-primary-foreground border-0">
                  <Plus className="h-4 w-4 mr-1" /> Novo Link
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Adicionar Link</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateLink} className="space-y-3">
                  <input type="text" placeholder="Título" value={linkTitle} onChange={e => setLinkTitle(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" required />
                  <input type="url" placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" required />
                  <textarea placeholder="Descrição (opcional)" value={linkDesc} onChange={e => setLinkDesc(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary h-16 resize-none" />
                  <Button type="submit" className="w-full gradient-primary text-primary-foreground border-0">Adicionar</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {links.length > 0 ? (
            <div className="space-y-2">
              {links.map(link => (
                <div key={link.id} className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="flex-1 min-w-0">
                    <a href={link.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1">
                      {link.title} <ExternalLink className="h-3 w-3" />
                    </a>
                    {link.description && <p className="text-xs text-muted-foreground truncate">{link.description}</p>}
                  </div>
                  <button onClick={() => { deleteLink(link.id).then(() => { toast.success("Link removido"); load(); }).catch((e: any) => toast.error(e.message)); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Link2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum link neste espaço</p>
            </div>
          )}
        </TabsContent>

        {/* ATTACHMENTS TAB */}
        <TabsContent value="attachments" className="space-y-3">
          <div className="flex justify-end">
            <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" />
            <Button size="sm" className="gradient-primary text-primary-foreground border-0"
              onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" /> {uploading ? "Enviando..." : "Upload"}
            </Button>
          </div>
          {attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map(att => (
                <div key={att.id} className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="flex-1 min-w-0">
                    <a href={getAttachmentUrl(att.file_path)} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1">
                      {att.file_name} <ExternalLink className="h-3 w-3" />
                    </a>
                    <p className="text-[11px] text-muted-foreground">
                      {att.content_type} · {att.file_size ? formatFileSize(att.file_size) : ""}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteAttachment(att)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Paperclip className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum anexo neste espaço</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {editingTask && (
        <EditTaskDialog task={editingTask} spaces={[{ id: space.id, name: space.name }]}
          open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)} onUpdated={load} />
      )}
      {completionTask && (
        <CompletionCommentDialog
          task={completionTask}
          open={!!completionTask}
          onOpenChange={(open) => !open && setCompletionTask(null)}
          onDone={() => { setCompletionTask(null); setFollowUpTask(completionTask); load(); }}
        />
      )}
      {followUpTask && (
        <FollowUpDialog completedTask={followUpTask} spaces={[{ id: space.id, name: space.name }]}
          open={!!followUpTask} onOpenChange={(open) => !open && setFollowUpTask(null)} onCreated={load} />
      )}
    </div>
  );
}
