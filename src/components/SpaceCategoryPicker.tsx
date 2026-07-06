import { useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchSpaceCategories, createSpaceCategory } from "@/lib/api";
import { Check, Plus, Tag, X } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
}

interface SpaceCategoryPickerProps {
  value: string | null;
  onChange: (categoryId: string | null, category: Category | null) => void;
}

export function SpaceCategoryPicker({ value, onChange }: SpaceCategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const data = await fetchSpaceCategories();
      setCategories(data || []);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
    }
  }, [open]);

  const selected = useMemo(
    () => categories.find(c => c.id === value) || null,
    [categories, value],
  );

  const q = query.trim().toLowerCase();
  const filtered = q
    ? categories.filter(c => c.name.toLowerCase().includes(q))
    : categories;
  const exact = categories.find(c => c.name.toLowerCase() === q);

  const handleCreate = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const cat = await createSpaceCategory(query.trim());
      await load();
      onChange(cat.id, cat);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (cat: Category) => {
    onChange(cat.id, cat);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0 && !exact) {
        handleSelect(filtered[0]);
      } else if (query.trim() && !exact) {
        handleCreate();
      } else if (exact) {
        handleSelect(exact);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted/60 text-[12px] text-foreground transition-colors"
          >
            <Tag className="h-3 w-3 text-muted-foreground" />
            {selected ? (
              <span className="truncate max-w-[160px]">{selected.name}</span>
            ) : (
              <span className="text-muted-foreground">Sem categoria</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 w-64">
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Buscar ou criar categoria..."
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && !query.trim() && (
              <div className="px-3 py-4 text-[12px] text-muted-foreground text-center">
                Nenhuma categoria ainda.
              </div>
            )}
            {filtered.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelect(cat)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted/60 transition-colors"
              >
                <Tag className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate">{cat.name}</span>
                {value === cat.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
            {query.trim() && !exact && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted/60 transition-colors border-t border-border/60 mt-1 pt-2"
              >
                <Plus className="h-3.5 w-3.5 text-primary" />
                <span>Criar “{query.trim()}”</span>
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selected && (
        <button
          type="button"
          onClick={() => onChange(null, null)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Remover categoria"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
