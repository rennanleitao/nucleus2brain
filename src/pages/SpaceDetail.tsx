import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchSpace, fetchTasksBySpace, fetchNotesBySpace, fetchLinksBySpace,
  fetchAttachments, uploadAttachment, deleteAttachment, getAttachmentUrl,
  createTask, createNote, createLink, deleteLink, updateTask, deleteTask, deleteNote,
} from "@/lib/api";
import { TaskCard } from "@/components/TaskCard";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { EditNoteDialog } from "@/components/EditNoteDialog";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, CheckSquare, FileText, Link2, Paperclip, Plus, Trash2, ExternalLink, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function SpaceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [space, setSpace] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [followUpTask, setFollowUpTask] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  // Link creation
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDesc, setLinkDesc] = useState("");

  // Note creation
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteTags, setNoteTags] = useState("");

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
      if (newStatus === "completed") setFollowUpTask(task);
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

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    try {
      const tags = noteTags.split(",").map(t => t.trim()).filter(Boolean);
      await createNote({ title: noteTitle.trim(), content: noteContent, space_id: id!, tags });
      toast.success("Nota criada!");
      setNoteTitle(""); setNoteContent(""); setNoteTags(""); setNoteDialogOpen(false);
      load();
    } catch (err: any) { toast.error(err.message); }
  };

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
          <span className="text-3xl">{space.icon}</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{space.name}</h1>
            {space.description && <p className="text-sm text-muted-foreground">{space.description}</p>}
          </div>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="secondary" className="gap-1"><CheckSquare className="h-3 w-3" /> {tasks.filter(t => t.status !== "completed").length} tarefas ativas</Badge>
        <Badge variant="secondary" className="gap-1"><FileText className="h-3 w-3" /> {notes.length} notas</Badge>
        <Badge variant="secondary" className="gap-1"><Link2 className="h-3 w-3" /> {links.length} links</Badge>
        <Badge variant="secondary" className="gap-1"><Paperclip className="h-3 w-3" /> {attachments.length} anexos</Badge>
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
          <div className="flex justify-end">
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
            <div className="text-center py-8">
              <CheckSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma tarefa neste espaço</p>
            </div>
          )}
        </TabsContent>

        {/* NOTES TAB */}
        <TabsContent value="notes" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-primary text-primary-foreground border-0">
                  <Plus className="h-4 w-4 mr-1" /> Nova Nota
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Nova Nota</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateNote} className="space-y-3">
                  <input type="text" placeholder="Título" value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" required />
                  <textarea placeholder="Conteúdo..." value={noteContent} onChange={e => setNoteContent(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary h-32 resize-none" />
                  <input type="text" placeholder="Tags (separadas por vírgula)" value={noteTags} onChange={e => setNoteTags(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
                  <Button type="submit" className="w-full gradient-primary text-primary-foreground border-0">Criar Nota</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {notes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {notes.map(note => (
                <div key={note.id} onClick={() => setEditingNote(note)}
                  className="group p-4 rounded-xl border border-border bg-card hover:shadow-elevated transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold">{note.title}</h3>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-2 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex gap-1 flex-wrap">
                    {(note.tags || []).map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma nota neste espaço</p>
            </div>
          )}
        </TabsContent>

        {/* LINKS TAB */}
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
                  <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
                  <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
      {editingNote && (
        <EditNoteDialog note={editingNote} spaces={[{ id: space.id, name: space.name }]}
          open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)} onUpdated={load} />
      )}
      {followUpTask && (
        <FollowUpDialog completedTask={followUpTask} spaces={[{ id: space.id, name: space.name }]}
          open={!!followUpTask} onOpenChange={(open) => !open && setFollowUpTask(null)} onCreated={load} />
      )}
    </div>
  );
}
