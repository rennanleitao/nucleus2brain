import { useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Tag as TagIcon, ArrowRightLeft, X, Check } from "lucide-react";
import { toast } from "sonner";

interface TagPickerPopoverProps {
  allTags: string[];
  currentTag: string;
  excludeTags?: string[]; // don't show these
  mode: "add" | "move";
  onPick: (tag: string) => Promise<void> | void;
  children: React.ReactNode;
}

export function TagPickerPopover({
  allTags,
  currentTag,
  excludeTags = [],
  mode,
  onPick,
  children,
}: TagPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
    }
  }, [open]);

  const q = query.trim().toLowerCase().replace(/^#/, "");
  const available = useMemo(() => {
    return allTags.filter(t => !excludeTags.includes(t) && t !== currentTag);
  }, [allTags, excludeTags, currentTag]);
  const filtered = q ? available.filter(t => t.toLowerCase().includes(q)) : available;
  const exact = available.find(t => t.toLowerCase() === q);

  const handlePick = async (t: string) => {
    setSaving(true);
    try {
      await onPick(t);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = () => {
    const clean = query.trim().replace(/^#/, "");
    if (!clean) return;
    handlePick(clean);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (exact) handlePick(exact);
      else if (filtered.length > 0) handlePick(filtered[0]);
      else if (query.trim()) handleCreate();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="p-0 w-64" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2 border-b border-border/60">
          <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
            {mode === "add" ? "Adicionar tag" : "Mover para tag"}
          </p>
        </div>
        <div className="p-2 border-b border-border/60">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Buscar ou criar tag..."
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 && !query.trim() && (
            <div className="px-3 py-4 text-[12px] text-muted-foreground text-center">
              Nenhuma outra tag disponível.
            </div>
          )}
          {filtered.map(t => (
            <button
              key={t}
              type="button"
              disabled={saving}
              onClick={() => handlePick(t)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted/60 transition-colors"
            >
              <TagIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 truncate">#{t}</span>
            </button>
          ))}
          {query.trim() && !exact && (
            <button
              type="button"
              disabled={saving}
              onClick={handleCreate}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted/60 transition-colors border-t border-border/60 mt-1 pt-2"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span>Criar “#{query.trim().replace(/^#/, "")}”</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Small icon-button trio: add / move / remove
interface TagItemActionsProps {
  allTags: string[];
  currentTag: string;
  itemTags?: string[]; // for notes: current list; disables "add" if the new tag already present
  onAdd?: (tag: string) => Promise<void>;
  onMove: (tag: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

export function TagItemActions({ allTags, currentTag, itemTags, onAdd, onMove, onRemove }: TagItemActionsProps) {
  const [removing, setRemoving] = useState(false);
  return (
    <div className="flex items-center gap-0.5 opacity-70 group-hover/item:opacity-100 transition-opacity">
      {onAdd && (
        <TagPickerPopover
          allTags={allTags}
          currentTag={currentTag}
          excludeTags={itemTags || []}
          mode="add"
          onPick={onAdd}
        >
          <button
            type="button"
            title="Adicionar outra tag"
            className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <Plus className="h-3 w-3" />
          </button>
        </TagPickerPopover>
      )}
      <TagPickerPopover
        allTags={allTags}
        currentTag={currentTag}
        excludeTags={itemTags || []}
        mode="move"
        onPick={onMove}
      >
        <button
          type="button"
          title="Mover para outra tag"
          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={e => e.stopPropagation()}
        >
          <ArrowRightLeft className="h-3 w-3" />
        </button>
      </TagPickerPopover>
      <button
        type="button"
        title="Remover desta tag"
        disabled={removing}
        className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
        onClick={async (e) => {
          e.stopPropagation();
          setRemoving(true);
          try { await onRemove(); } catch (err: any) { toast.error(err.message); } finally { setRemoving(false); }
        }}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
