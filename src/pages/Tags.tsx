import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchNotes } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tag, FileText, Search } from "lucide-react";
import { toast } from "sonner";

export default function Tags() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes()
      .then(setNotes)
      .catch((err: any) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Build tag → notes map
  const tagMap = new Map<string, any[]>();
  notes.forEach(note => {
    (note.tags || []).forEach((tag: string) => {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag)!.push(note);
    });
  });

  const allTags = [...tagMap.keys()].sort();
  const filteredTags = allTags.filter(t => !search || t.toLowerCase().includes(search.toLowerCase()));

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
      {/* Tag list sidebar */}
      <div className="w-72 border-r border-border flex flex-col bg-muted/20 flex-shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
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
            {filteredTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between ${
                  selectedTag === tag ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                }`}
              >
                <span className="text-sm font-medium">#{tag}</span>
                <Badge variant="secondary" className="text-[10px]">{tagMap.get(tag)!.length}</Badge>
              </button>
            ))}
            {filteredTags.length === 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground">Nenhuma tag encontrada</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Notes for selected tag */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedTag ? (
          <>
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" /> #{selectedTag}
                <Badge variant="secondary" className="text-xs">{tagMap.get(selectedTag)!.length} notas</Badge>
              </h2>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {tagMap.get(selectedTag)!.map(note => (
                  <button
                    key={note.id}
                    onClick={() => navigate("/notes", { state: { noteId: note.id } })}
                    className="w-full text-left p-4 rounded-xl border border-border bg-card hover:shadow-elevated transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">{note.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
                      {stripHtml(note.content || "Sem conteúdo")}
                    </p>
                    <div className="flex gap-1 flex-wrap mt-2 ml-6">
                      {(note.tags || []).map((t: string) => (
                        <Badge key={t} variant={t === selectedTag ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          #{t}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Selecione uma tag para ver as notas associadas</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
