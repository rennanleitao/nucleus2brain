import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, CheckSquare, FileText, FolderOpen } from "lucide-react";
import { fetchTasks, fetchNotes, fetchSpaces } from "@/lib/api";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  type: "task" | "note" | "space";
  id: string;
  title: string;
  subtitle?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const navigate = useNavigate();

  // Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const lower = q.toLowerCase();

    try {
      const [tasks, notes, spaces] = await Promise.all([fetchTasks(), fetchNotes(), fetchSpaces()]);

      const r: SearchResult[] = [];

      for (const t of tasks) {
        if (t.title.toLowerCase().includes(lower)) {
          r.push({ type: "task", id: t.id, title: t.title, subtitle: `${t.status} · ${t.priority}` });
        }
      }
      for (const n of notes) {
        if (n.title.toLowerCase().includes(lower) || n.content?.toLowerCase().includes(lower)) {
          r.push({ type: "note", id: n.id, title: n.title, subtitle: n.spaces?.name });
        }
      }
      for (const s of spaces) {
        if (s.name.toLowerCase().includes(lower)) {
          r.push({ type: "space", id: s.id, title: s.name, subtitle: s.description });
        }
      }

      setResults(r.slice(0, 10));
      setSelectedIdx(0);
    } catch {}
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 200);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    if (result.type === "task") navigate("/tasks");
    else if (result.type === "note") navigate("/notes");
    else if (result.type === "space") navigate("/spaces");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[selectedIdx]) { handleSelect(results[selectedIdx]); }
  };

  const icons = { task: CheckSquare, note: FileText, space: FolderOpen };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search tasks, notes, spaces..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            autoFocus
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">ESC</kbd>
        </div>

        {results.length > 0 ? (
          <div className="max-h-72 overflow-auto py-2">
            {results.map((r, i) => {
              const Icon = icons[r.type];
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleSelect(r)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                    i === selectedIdx ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    {r.subtitle && <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize">{r.type}</span>
                </button>
              );
            })}
          </div>
        ) : query ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No results found</div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">Start typing to search...</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
