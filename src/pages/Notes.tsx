import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchNotes, fetchSpaces, createNote, updateNote, deleteNote } from "@/lib/api";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, Plus, Trash2, Search, ArrowLeft, Tag, X,
} from "lucide-react";
import { toast } from "sonner";

export default function Notes() {
  const navigate = useNavigate();
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
      if (merged.length !== prev.length) setDirty(true);
      return merged;
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

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-fade-in">
      {/* Sidebar - Note list */}
      <div className="w-80 border-r border-border flex flex-col bg-muted/20 flex-shrink-0">
        {/* Header */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-muted-foreground" /> Notas
              <Badge variant="secondary" className="text-[10px] ml-1">{notes.length}</Badge>
            </h2>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCreateNote}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text" placeholder="Buscar notas..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>

          {/* Tag filter */}
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

        {/* Note list */}
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
                <p className="text-sm font-medium truncate">{note.title}</p>
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

      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedNote ? (
          <>
            {/* Note header */}
            <div className="p-4 border-b border-border space-y-3">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text" value={editTitle}
                  onChange={e => { setEditTitle(e.target.value); setDirty(true); }}
                  className="flex-1 text-xl font-bold bg-transparent outline-none placeholder:text-muted-foreground"
                  placeholder="Título da nota"
                />
                <div className="flex items-center gap-2 flex-shrink-0">
                  {dirty && (
                    <Button size="sm" onClick={handleSave} disabled={saving}
                      className="gradient-primary text-primary-foreground border-0 text-xs">
                      {saving ? "Salvando..." : "Salvar"}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(selectedNote.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select value={editSpaceId} onChange={e => { setEditSpaceId(e.target.value); setDirty(true); }}
                  className="bg-background border border-border rounded-lg px-2 py-1 text-xs outline-none focus:border-primary">
                  <option value="">Sem espaço</option>
                  {spaces.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>

                {/* Tags */}
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  {editTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/20"
                      onClick={() => removeTag(tag)}>
                      #{tag} <X className="h-2.5 w-2.5" />
                    </Badge>
                  ))}
                  {editTags.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">Use #tag no texto para criar tags</span>
                  )}
                </div>
              </div>
            </div>

            {/* Rich text editor */}
            <div className="flex-1 overflow-auto">
              <RichTextEditor
                content={editContent}
                onChange={(html) => { setEditContent(html); setDirty(true); }}
                onTagsDetected={handleTagsDetected}
                placeholder="Comece a escrever... Use #tag para criar tags, e o botão ☑ para criar checklists"
                className="border-0 rounded-none min-h-full"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Selecione uma nota ou crie uma nova</p>
              <Button onClick={handleCreateNote} className="gradient-primary text-primary-foreground border-0">
                <Plus className="h-4 w-4 mr-1" /> Nova Nota
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
