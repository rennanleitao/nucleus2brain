import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchNotes, fetchTaggedSnippets, deleteTaggedSnippet, fetchTasks,
  renameTag, deleteTag,
  addTagToNote, removeTagFromNote, replaceTagOnNote,
  setSnippetTag, setTaskTag,
} from "@/lib/api";
import { getBrtToday } from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tag, FileText, Search, Quote, Trash2, ArrowLeft, Pencil, CheckSquare, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { TagItemActions } from "@/components/TagItemActions";

export default function Tags() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [notes, setNotes] = useState<any[]>([]);
  const [snippets, setSnippets] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Edit/delete state
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleteConfirmTag, setDeleteConfirmTag] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const [n, s, t] = await Promise.all([fetchNotes(), fetchTaggedSnippets(), fetchTasks()]);
      setNotes(n);
      setSnippets(s);
      setTasks(t);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tagMap = new Map<string, any[]>();
  notes.forEach(note => {
    (note.tags || []).forEach((tag: string) => {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag)!.push(note);
    });
  });

  const snippetTagMap = new Map<string, any[]>();
  snippets.forEach(s => {
    if (!s.tag) return;
    if (!snippetTagMap.has(s.tag)) snippetTagMap.set(s.tag, []);
    snippetTagMap.get(s.tag)!.push(s);
  });

  const taskTagMap = new Map<string, any[]>();
  tasks.forEach(t => {
    if (t.tag) {
      if (!taskTagMap.has(t.tag)) taskTagMap.set(t.tag, []);
      taskTagMap.get(t.tag)!.push(t);
    }
  });

  const allTagsSet = new Set([...tagMap.keys(), ...snippetTagMap.keys(), ...taskTagMap.keys()]);
  const allTags = [...allTagsSet].sort();
  const filteredTags = allTags.filter(t => !search || t.toLowerCase().includes(search.toLowerCase()));

  const stripHtml = (html: string) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const handleDeleteSnippet = async (id: string) => {
    try {
      await deleteTaggedSnippet(id);
      toast.success("Trecho removido");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRename = async () => {
    const newName = renameValue.trim().replace(/^#/, "");
    if (!newName || newName === renameTarget) { setRenameOpen(false); return; }
    setRenaming(true);
    try {
      await renameTag(renameTarget, newName);
      toast.success(`Tag #${renameTarget} renomeada para #${newName}`);
      if (selectedTag === renameTarget) setSelectedTag(newName);
      setRenameOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!deleteConfirmTag) return;
    setDeleting(true);
    try {
      await deleteTag(deleteConfirmTag);
      toast.success(`Tag #${deleteConfirmTag} excluída`);
      if (selectedTag === deleteConfirmTag) setSelectedTag(null);
      setDeleteConfirmTag(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  const selectedNotes = selectedTag ? (tagMap.get(selectedTag) || []) : [];
  const selectedSnippets = selectedTag ? (snippetTagMap.get(selectedTag) || []) : [];
  const selectedTasks = selectedTag ? (taskTagMap.get(selectedTag) || []) : [];

  const showList = !isMobile || !selectedTag;
  const showContent = !isMobile || !!selectedTag;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-fade-in">
      {/* Tag list sidebar */}
      {showList && (
        <div className={`${isMobile ? "w-full" : "w-72"} border-r border-border flex flex-col bg-muted/20 flex-shrink-0`}>
          <div className="p-3 border-b border-border space-y-2">
            <h2 className="text-small font-semibold flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-muted-foreground" /> Tags
              <Badge variant="secondary" className="text-[10px] ml-1">{allTags.length}</Badge>
            </h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text" placeholder="Buscar tags..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {filteredTags.map(tag => {
                const noteCount = tagMap.get(tag)?.length || 0;
                const snippetCount = snippetTagMap.get(tag)?.length || 0;
                const taskCount = taskTagMap.get(tag)?.length || 0;
                return (
                  <div key={tag} className="group flex items-center">
                    <button
                      onClick={() => setSelectedTag(tag)}
                      className={`flex-1 text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between min-w-0 ${
                        selectedTag === tag ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      }`}
                    >
                      <span className="text-small font-medium truncate">#{tag}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {noteCount > 0 && <Badge variant="secondary" className="text-[10px]">{noteCount} <FileText className="h-2.5 w-2.5 ml-0.5" /></Badge>}
                        {snippetCount > 0 && <Badge variant="outline" className="text-[10px]">{snippetCount} <Quote className="h-2.5 w-2.5 ml-0.5" /></Badge>}
                        {taskCount > 0 && <Badge variant="outline" className="text-[10px]">{taskCount} <CheckSquare className="h-2.5 w-2.5 ml-0.5" /></Badge>}
                      </div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-0.5">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => { setRenameTarget(tag); setRenameValue(tag); setRenameOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirmTag(tag)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
              {filteredTags.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground">Nenhuma tag encontrada</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Content for selected tag */}
      {showContent && (
        <div className="flex-1 flex flex-col min-w-0">
          {selectedTag ? (
            <>
              <div className="p-3 sm:p-4 border-b border-border flex items-center gap-2">
                {isMobile && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={() => setSelectedTag(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <h2 className="text-h1 flex items-center gap-2 flex-1">
                  <Tag className="h-5 w-5 text-primary" /> #{selectedTag}
                </h2>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setRenameTarget(selectedTag); setRenameValue(selectedTag); setRenameOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteConfirmTag(selectedTag)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Tabs defaultValue="snippets" className="flex-1 flex flex-col">
                <TabsList className="mx-3 sm:mx-4 mt-2 w-fit">
                  <TabsTrigger value="snippets" className="text-xs gap-1">
                    <Quote className="h-3.5 w-3.5" /> Trechos ({selectedSnippets.length})
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs gap-1">
                    <FileText className="h-3.5 w-3.5" /> Notas ({selectedNotes.length})
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="text-xs gap-1">
                    <CheckSquare className="h-3.5 w-3.5" /> Tasks ({selectedTasks.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="snippets" className="flex-1 m-0">
                  <ScrollArea className="h-full">
                    <div className="p-3 sm:p-4 space-y-2">
                      {selectedSnippets.length === 0 ? (
                        <div className="text-center py-8">
                          <Quote className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">Nenhum trecho tageado.</p>
                        </div>
                      ) : selectedSnippets.map(s => (
                        <div key={s.id} className="group/item p-3 sm:p-4 rounded-xl border border-border bg-card hover:shadow-elevated transition-all">
                          <div className="flex items-start justify-between gap-2">
                            <blockquote className="border-l-2 border-foreground/20 pl-3 text-small italic text-foreground flex-1 min-w-0">
                              "{s.snippet_text}"
                            </blockquote>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <TagItemActions
                                allTags={allTags}
                                currentTag={selectedTag!}
                                onMove={async (t) => { await setSnippetTag(s.id, t); await load(); toast.success(`Movido para #${t}`); }}
                                onRemove={async () => { await setSnippetTag(s.id, null); await load(); toast.success("Tag removida"); }}
                              />
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteSnippet(s.id)} title="Excluir trecho">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            {s.notes?.title && (
                              <button
                                onClick={() => navigate("/notes", { state: { noteId: s.note_id } })}
                                className="text-micro text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                <FileText className="h-3 w-3" /> {s.notes.title}
                              </button>
                            )}
                            <span className="text-micro text-muted-foreground">
                              {new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="notes" className="flex-1 m-0">
                  <ScrollArea className="h-full">
                    <div className="p-3 sm:p-4 space-y-2">
                      {selectedNotes.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-xs text-muted-foreground">Nenhuma nota com esta tag</p>
                        </div>
                      ) : selectedNotes.map((note: any) => (
                        <div
                          key={note.id}
                          className="group/item w-full text-left p-3 sm:p-4 rounded-xl border border-border bg-card hover:shadow-elevated transition-all cursor-pointer"
                          onClick={() => navigate("/notes", { state: { noteId: note.id } })}
                        >
                          <div className="flex items-start gap-2 mb-1">
                            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <h3 className="text-small font-semibold flex-1">{note.title}</h3>
                            <TagItemActions
                              allTags={allTags}
                              currentTag={selectedTag!}
                              itemTags={note.tags || []}
                              onAdd={async (t) => { await addTagToNote(note.id, t); await load(); toast.success(`Tag #${t} adicionada`); }}
                              onMove={async (t) => { await replaceTagOnNote(note.id, selectedTag!, t); await load(); toast.success(`Movido para #${t}`); }}
                              onRemove={async () => { await removeTagFromNote(note.id, selectedTag!); await load(); toast.success("Tag removida"); }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
                            {stripHtml(note.content || "Sem conteúdo")}
                          </p>
                          {(note.tags?.length ?? 0) > 1 && (
                            <div className="flex flex-wrap gap-1 mt-2 ml-6">
                              {(note.tags as string[]).filter((t: string) => t !== selectedTag).map((t: string) => (
                                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="tasks" className="flex-1 m-0">
                  <ScrollArea className="h-full">
                    <div className="p-3 sm:p-4 space-y-2">
                      {selectedTasks.length === 0 ? (
                        <div className="text-center py-8">
                          <CheckSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">Nenhuma task com esta tag</p>
                        </div>
                      ) : selectedTasks.map((task: any) => (
                        <div
                          key={task.id}
                          onClick={() => navigate("/tasks")}
                          className="group/item w-full text-left p-3 sm:p-4 rounded-xl border border-border bg-card hover:shadow-elevated transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                              task.status === "completed" ? "bg-primary border-primary" : "border-muted-foreground/40"
                            }`}>
                              {task.status === "completed" && (
                                <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <h3 className={`text-small font-semibold flex-1 ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </h3>
                            {task.priority === "high" && <Badge variant="destructive" className="text-[10px]">Alta</Badge>}
                            <TagItemActions
                              allTags={allTags}
                              currentTag={selectedTag!}
                              onMove={async (t) => { await setTaskTag(task.id, t); await load(); toast.success(`Movido para #${t}`); }}
                              onRemove={async () => { await setTaskTag(task.id, null); await load(); toast.success("Tag removida"); }}
                            />
                          </div>
                          {task.due_date && (
                            <p className={`text-xs ml-6 ${task.due_date < getBrtToday() ? "text-destructive" : "text-muted-foreground"}`}>
                              {new Date(task.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-small text-muted-foreground">Selecione uma tag para ver notas, trechos e tasks</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Renomear tag</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              placeholder="Novo nome da tag"
              onKeyDown={e => e.key === "Enter" && handleRename()}
            />
            <p className="text-xs text-muted-foreground">
              A tag #{renameTarget} será renomeada em todas as notas, trechos e tasks.
            </p>
            <Button onClick={handleRename} disabled={renaming} className="w-full">
              {renaming ? "Renomeando..." : "Renomear"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmTag} onOpenChange={open => !open && setDeleteConfirmTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tag #{deleteConfirmTag}?</AlertDialogTitle>
            <AlertDialogDescription>
              A tag será removida das notas, tasks e trechos vinculados, mas nenhum desses itens será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTag} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
