import { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchSpaceCategories, createSpaceCategory, updateSpace } from "@/lib/api";
import { Check, Plus, Tag, X } from "lucide-react";
import { toast } from "sonner";

interface Category { id: string; name: string; }

interface Props {
  spaceId: string;
  category: Category | null | undefined;
  onChanged?: () => void;
}

export function SpaceCategoryQuickEdit({ spaceId, category, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const stopClick = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };

  const q = query.trim().toLowerCase();
  const filtered = q ? categories.filter(c => c.name.toLowerCase().includes(q)) : categories;
  const exact = categories.find(c => c.name.toLowerCase() === q);

  const applyCategory = async (id: string | null) => {
    setSaving(true);
    try {
      await updateSpace(spaceId, { category_id: id } as any);
      toast.success(id ? "Categoria atualizada" : "Categoria removida");
      setOpen(false);
      onChanged?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const cat = await createSpaceCategory(query.trim());
      await applyCategory(cat.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (exact) applyCategory(exact.id);
      else if (filtered.length > 0) applyCategory(filtered[0].id);
      else if (query.trim()) handleCreate();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); }}
          onDoubleClick={stopClick}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); setOpen(o => !o); } }}
          className={
            category
              ? "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/60 hover:bg-accent hover:text-foreground transition-colors cursor-pointer flex-shrink-0"
              : "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground/70 border border-dashed border-border hover:bg-muted hover:text-foreground transition-colors cursor-pointer flex-shrink-0"
          }
          title={category ? "Alterar categoria" : "Adicionar categoria"}
        >
          {category ? (
            <>{category.name}</>
          ) : (
            <><Plus className="h-2.5 w-2.5" /> Categoria</>
          )}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-64" onClick={stopClick} onDoubleClick={stopClick}>
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
              disabled={saving}
              onClick={() => applyCategory(cat.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted/60 transition-colors"
            >
              <Tag className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 truncate">{cat.name}</span>
              {category?.id === cat.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
          {query.trim() && !exact && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading || saving}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted/60 transition-colors border-t border-border/60 mt-1 pt-2"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span>Criar “{query.trim()}”</span>
            </button>
          )}
          {category && (
            <button
              type="button"
              disabled={saving}
              onClick={() => applyCategory(null)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-muted/60 hover:text-destructive transition-colors border-t border-border/60 mt-1 pt-2"
            >
              <X className="h-3 w-3" />
              <span>Remover categoria</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
