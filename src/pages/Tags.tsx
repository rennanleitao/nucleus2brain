import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchNotes, fetchTaggedSnippets, deleteTaggedSnippet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tag, FileText, Search, Quote, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Tags() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [notes, setNotes] = useState<any[]>([]);
  const [snippets, setSnippets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const load = async () => {
    try {
      const [n, s] = await Promise.all([fetchNotes(), fetchTaggedSnippets()]);
      setNotes(n);
      setSnippets(s);
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
    if (!snippetTagMap.has(s.tag)) snippetTagMap.set(s.tag, []);
    snippetTagMap.get(s.tag)!.push(s);
  });

  const allTagsSet = new Set([...tagMap.keys(), ...snippetTagMap.keys()]);
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

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  const selectedNotes = selectedTag ? (tagMap.get(selectedTag) || []) : [];
  const selectedSnippets = selectedTag ? (snippetTagMap.get(selectedTag) || []) : [];

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
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between ${
                      selectedTag === tag ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                    }`}
                  >
                    <span className="text-small font-medium">#{tag}</span>
                    <div className="flex items-center gap-1">
                      {noteCount > 0 && <Badge variant="secondary" className="text-[10px]">{noteCount} <FileText className="h-2.5 w-2.5 ml-0.5" /></Badge>}
                      {snippetCount > 0 && <Badge variant="outline" className="text-[10px]">{snippetCount} <Quote className="h-2.5 w-2.5 ml-0.5" /></Badge>}
                    </div>
                  </button>
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
                <h2 className="text-h1 flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" /> #{selectedTag}
                </h2>
              </div>
              <Tabs defaultValue="snippets" className="flex-1 flex flex-col">
                <TabsList className="mx-3 sm:mx-4 mt-2 w-fit">
                  <TabsTrigger value="snippets" className="text-xs gap-1">
                    <Quote className="h-3.5 w-3.5" /> Trechos ({selectedSnippets.length})
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs gap-1">
                    <FileText className="h-3.5 w-3.5" /> Notas ({selectedNotes.length})
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
                        <div key={s.id} className="p-3 sm:p-4 rounded-xl border border-border bg-card hover:shadow-elevated transition-all">
                          <div className="flex items-start justify-between gap-2">
                            <blockquote className="border-l-2 border-foreground/20 pl-3 text-small italic text-foreground flex-1 min-w-0">
                              "{s.snippet_text}"
                            </blockquote>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
                              onClick={() => handleDeleteSnippet(s.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
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
                        <button
                          key={note.id}
                          onClick={() => navigate("/notes", { state: { noteId: note.id } })}
                          className="w-full text-left p-3 sm:p-4 rounded-xl border border-border bg-card hover:shadow-elevated transition-all"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-small font-semibold">{note.title}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
                            {stripHtml(note.content || "Sem conteúdo")}
                          </p>
                        </button>
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
                <p className="text-small text-muted-foreground">Selecione uma tag para ver notas e trechos</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}