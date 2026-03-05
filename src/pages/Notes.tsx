import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchNotes, fetchSpaces, createNote, updateNote, deleteNote, createTask, fetchTasksBySpace } from "@/lib/api";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, Plus, Trash2, Search, ArrowLeft, Tag, X, CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Notes() {
  const navigate = useNavigate();
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

  useEffect(() => { load(); }, []);

  const allTags = [...new Set(notes.flatMap(n => n.tags || []))].sort();

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
      await updateNote(selectedNote.id, {
        title: editTitle.trim(),
        content: editContent,
        tags: editTags,
        space_id: editSpaceId || null,
      });
      setDirty(false);
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
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const handleBack = () => {
    if (dirty) handleSave();
    setSelectedNote(null);
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  // On mobile, show either list or editor
  const showList = !isMobile || !selectedNote;
  const showEditor = !isMobile || !!selectedNote;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-fade-in">
      {/* Sidebar - Note list */}
      {showList && (
        <div className={`${isMobile ? "w-full" : "w-80"} border-r border-border flex flex-col bg-muted/20 flex-shrink-0`}>
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-small font-semibold flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-muted-foreground" /> Notas
                <Badge variant="secondary" className="text-[10px] ml-1">{notes.length}</Badge>
              </h2>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCreateNote}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text" placeholder="Buscar notas..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary"
              />
            </div>

            {allTags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {filterTag && (
                  <Badge variant="default" className="text-[10px] cursor-pointer gap-1" onClick={() => setFilterTag(null)}>
                    #{filterTag} <X className="h-2.5 w-2.5" />
                  </Badge>
                )}
                {!filterTag && allTags.slice(0, 8).map(tag => (
                  <Badge key={tag} variant="outline" className="text-[10px] cursor-pointer hover:bg-accent" onClick={() => setFilterTag(tag)}>
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {filteredNotes.map(note => (
                <button
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedNote?.id === note.id
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <p className="text-small font-medium truncate">{note.title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                    {stripHtml(note.content || "Sem conteúdo")}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {note.spaces?.name && (
                      <span className="text-[10px] text-muted-foreground">{note.spaces.name}</span>
                    )}
                    {(note.tags || []).slice(0, 3).map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-[9px] px-1 py-0">#{tag}</Badge>
                    ))}
                  </div>
                </button>
              ))}
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
                    <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={handleBack}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <input
                    type="text" value={editTitle}
                    onChange={e => { setEditTitle(e.target.value); setDirty(true); }}
                    className="flex-1 text-h1 bg-transparent outline-none placeholder:text-muted-foreground min-w-0"
                    placeholder="Título da nota"
                  />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {dirty && (
                      <Button size="sm" onClick={handleSave} disabled={saving}
                        className="gradient-primary text-primary-foreground border-0 text-xs">
                        {saving ? "..." : "Salvar"}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(selectedNote.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select value={editSpaceId} onChange={e => { setEditSpaceId(e.target.value); setDirty(true); }}
                    className="bg-background border border-border rounded-lg px-2 py-1 text-xs outline-none focus:border-primary">
                    <option value="">Sem espaço</option>
                    {spaces.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                  </select>

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

              <div className="flex-1 overflow-auto">
                <RichTextEditor
                  content={editContent}
                  onChange={(html) => { setEditContent(html); setDirty(true); }}
                  onTagsDetected={handleTagsDetected}
                  onTaskDetected={async (taskTitle) => {
                    if (editSpaceId) {
                      try {
                        await createTask({ title: taskTitle, space_id: editSpaceId });
                        toast.success(`Task criada: ${taskTitle}`);
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    } else {
                      toast("Associe um espaço à nota para criar tasks com ()");
                    }
                  }}
                  noteId={selectedNote?.id}
                  existingTags={allTags}
                  placeholder="Comece a escrever... Use #tag para criar tags, (texto) para criar tasks"
                  className="border-0 rounded-none min-h-full"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
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