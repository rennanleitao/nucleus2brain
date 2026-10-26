import { useEffect, useState } from "react";
import { Check, Layers, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeTaskThemes } from "@/lib/taskThemes";

export function TaskThemePicker({ spaceId, value, onChange }: { spaceId: string; value: string[]; onChange: (themes: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setOptions([]); setError(false); setQuery("");
    if (!spaceId) return;
    setLoading(true);
    supabase.from("space_task_themes").select("name").eq("space_id", spaceId).order("name").then(({ data, error }) => {
      if (!active) return;
      setOptions((data || []).map(t => t.name)); setError(!!error); setLoading(false);
    });
    return () => { active = false; };
  }, [spaceId, open]);
  const allOptions = [...new Set([...options, ...value])];
  const filtered = allOptions.filter(name => name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  const exact = allOptions.find(name => name.toLocaleLowerCase("pt-BR") === query.trim().toLocaleLowerCase("pt-BR"));
  const add = (name: string) => { onChange(normalizeTaskThemes(spaceId, [...value, name])); setQuery(""); };
  return <div className="space-y-2">
    <label className="field-label flex items-center gap-1.5"><Layers className="h-3 w-3" /> Temas</label>
    {value.length > 0 && <div className="flex flex-wrap gap-1.5">{value.map(name => <span key={name} className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs">
      <span className="break-words min-w-0">{name}</span><Button type="button" variant="ghost" size="icon" className="h-5 w-5 shrink-0" aria-label={`Remover Tema ${name}`} onClick={() => onChange(value.filter(t => t !== name))}><X /></Button>
    </span>)}</div>}
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
      <Button type="button" variant="outline" disabled={!spaceId} className="w-full justify-start text-muted-foreground" aria-label="Selecionar Temas"><Plus />{spaceId ? "Buscar ou criar Tema" : "Selecione um Space"}</Button>
    </PopoverTrigger><PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] p-2 space-y-2">
      <Input aria-label="Buscar ou criar Tema" placeholder="Buscar ou criar Tema..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && query.trim()) { e.preventDefault(); add(exact || query); } }} />
      <div className="max-h-48 overflow-y-auto space-y-1">
        {loading && <p className="text-xs text-muted-foreground p-2">Carregando Temas...</p>}
        {error && <p role="alert" className="text-xs text-destructive p-2">Não foi possível carregar os Temas.</p>}
        {filtered.map(name => <Button key={name} type="button" variant="ghost" className="w-full justify-between h-auto min-h-9 whitespace-normal text-left text-xs" onClick={() => value.includes(name) ? onChange(value.filter(t => t !== name)) : add(name)}><span className="break-words min-w-0">{name}</span>{value.includes(name) && <Check className="shrink-0" />}</Button>)}
        {query.trim() && !exact && <Button type="button" variant="ghost" className="w-full justify-start whitespace-normal h-auto min-h-9 text-xs" onClick={() => add(query)}><Plus /><span className="break-words min-w-0">Criar Tema “{query.trim()}”</span></Button>}
      </div>
    </PopoverContent></Popover>
  </div>;
}