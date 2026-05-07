import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, FileText } from "lucide-react";

interface NoteItem {
  id: string;
  title: string;
}

interface LinkNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: NoteItem[];
  excludeId?: string | null;
  onSelect: (note: NoteItem) => void;
}

export function LinkNoteDialog({ open, onOpenChange, notes, excludeId, onSelect }: LinkNoteDialogProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return notes
      .filter((n) => n.id !== excludeId)
      .filter((n) => n.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50);
  }, [notes, excludeId, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="text-base">Vincular nota</DialogTitle>
        </DialogHeader>
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar nota..."
              className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma nota encontrada</p>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  onSelect(n);
                  onOpenChange(false);
                  setQuery("");
                }}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm flex items-center gap-2"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{n.title}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
