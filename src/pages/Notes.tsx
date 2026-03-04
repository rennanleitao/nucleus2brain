import { useEffect, useState } from "react";
import { fetchNotes, fetchSpaces, deleteNote } from "@/lib/api";
import { CreateNoteDialog } from "@/components/CreateNoteDialog";
import { EditNoteDialog } from "@/components/EditNoteDialog";
import { FileText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Notes() {
  const [notes, setNotes] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<any | null>(null);

  const load = async () => {
    try {
      const [n, s] = await Promise.all([fetchNotes(), fetchSpaces()]);
      setNotes(n); setSpaces(s);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteNote(id);
      toast.success("Note deleted");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" /> Notes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your second brain · {notes.length} notes</p>
        </div>
        <CreateNoteDialog spaces={spaces.map(s => ({ id: s.id, name: s.name }))} onCreated={load} />
      </div>

      {notes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {notes.map(note => (
            <div key={note.id} onClick={() => setEditingNote(note)}
              className="group p-4 rounded-xl border border-border bg-card hover:shadow-elevated transition-all cursor-pointer animate-fade-in">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold">{note.title}</h3>
                <div className="flex items-center gap-2">
                  {note.spaces?.name && (
                    <span className="text-[11px] text-muted-foreground">{note.spaces.name}</span>
                  )}
                  <button onClick={(e) => handleDelete(e, note.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3 mb-3 whitespace-pre-wrap">{note.content}</p>
              <div className="flex gap-1.5 flex-wrap">
                {(note.tags || []).map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No notes yet. Start capturing knowledge!</p>
        </div>
      )}

      {editingNote && (
        <EditNoteDialog
          note={editingNote}
          spaces={spaces.map(s => ({ id: s.id, name: s.name }))}
          open={!!editingNote}
          onOpenChange={(open) => !open && setEditingNote(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
