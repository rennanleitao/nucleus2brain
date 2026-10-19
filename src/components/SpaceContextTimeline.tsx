import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useHelenaSpeechInput } from "@/hooks/useHelenaSpeechInput";
import { getBrtToday } from "@/lib/timezone";
import { cn } from "@/lib/utils";

const DEFAULT_THEMES = ["Timeline de fatos", "Projetos estratégicos", "Pessoas-chave", "Riscos", "Oportunidades"];

interface Entry {
  id: string;
  theme: string;
  title: string;
  content: string | null;
  entry_date: string;
  created_at: string;
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return y === getBrtToday().slice(0, 4) ? `${day}/${m}` : `${day}/${m}/${y.slice(2)}`;
}

export function SpaceContextTimeline({ spaceId }: { spaceId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [theme, setTheme] = useState(DEFAULT_THEMES[0]);
  const [newTheme, setNewTheme] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(getBrtToday());
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Entry>>({});
  const speech = useHelenaSpeechInput();

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("space_context_entries")
      .select("id, theme, title, content, entry_date, created_at")
      .eq("space_id", spaceId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setEntries(data || []);
  };

  useEffect(() => { load(); }, [spaceId]);
  useEffect(() => { if (speech.error) toast.error(speech.error); }, [speech.error]);
  useEffect(() => {
    if (speech.isListening && speech.transcript) setContent(speech.transcript);
  }, [speech.isListening, speech.transcript]);

  const themes = useMemo(() => {
    const set = new Set(DEFAULT_THEMES);
    entries.forEach(e => set.add(e.theme));
    return Array.from(set);
  }, [entries]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    entries.forEach(e => { c[e.theme] = (c[e.theme] || 0) + 1; });
    return c;
  }, [entries]);

  const visible = filter === "all" ? entries : entries.filter(e => e.theme === filter);

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    visible.forEach(e => {
      const k = e.entry_date.slice(0, 7);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return Array.from(map.entries());
  }, [visible]);

  const toggleMic = () => {
    if (speech.isListening) {
      const t = speech.stop();
      if (t) setContent(t);
    } else speech.start();
  };

  const add = async () => {
    const finalTheme = theme === "__new" ? newTheme.trim() : theme;
    const body = content.trim();
    const t = title.trim() || body.split(/[.\n]/)[0].slice(0, 80);
    if (!finalTheme || !t) { toast.error("Informe tema e título ou conteúdo"); return; }
    if (speech.isListening) speech.abort();
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("space_context_entries").insert({
      space_id: spaceId, user_id: u.user?.id, theme: finalTheme, title: t, content: body || null, entry_date: date,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setTitle(""); setContent(""); setNewTheme(""); speech.resetTranscript();
    if (theme === "__new") setTheme(finalTheme);
    toast.success("Contexto registrado");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("space_context_entries").delete().eq("id", id);
    if (error) toast.error(error.message); else setEntries(prev => prev.filter(e => e.id !== id));
  };

  const saveEdit = async () => {
    if (!editId) return;
    const { error } = await (supabase as any).from("space_context_entries").update({
      title: editDraft.title, content: editDraft.content || null, entry_date: editDraft.entry_date, theme: editDraft.theme,
    }).eq("id", editId);
    if (error) { toast.error(error.message); return; }
    setEditId(null); load();
  };

  const monthLabel = (k: string) => {
    const [y, m] = k.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <select
            value={theme}
            onChange={e => setTheme(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            {themes.map(t => <option key={t} value={t}>{t}</option>)}
            <option value="__new">+ Novo tema...</option>
          </select>
          {theme === "__new" && (
            <Input value={newTheme} onChange={e => setNewTheme(e.target.value)} placeholder="Nome do tema" className="h-9 w-44" />
          )}
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-40" />
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título (opcional)" className="h-9 flex-1 min-w-[160px]" />
        </div>
        <div className="flex gap-2">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={speech.isListening ? "Ouvindo..." : "O que aconteceu? Fato, decisão, pessoa, projeto..."}
            className="min-h-[70px] text-sm"
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(); }}
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={toggleMic}
              title={speech.isListening ? "Parar" : "Ditar por voz"}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                speech.isListening
                  ? "border-destructive/40 bg-destructive/10 text-destructive animate-pulse"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {speech.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <Button size="icon" className="h-9 w-9" onClick={add} disabled={saving} title="Registrar">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Theme filter */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter("all")}
          className={cn("rounded-full border px-3 py-1 text-xs", filter === "all" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
          Todos · {entries.length}
        </button>
        {themes.filter(t => counts[t]).map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={cn("rounded-full border px-3 py-1 text-xs", filter === t ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {t} · {counts[t]}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhum contexto registrado ainda.</p>
      ) : grouped.map(([month, items]) => (
        <div key={month} className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground capitalize">{monthLabel(month)}</h3>
          <div className="relative ml-2 border-l border-border pl-4 space-y-3">
            {items.map(e => (
              <div key={e.id} className="group relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-foreground/70" />
                {editId === e.id ? (
                  <div className="space-y-2 rounded-lg border border-border p-2">
                    <div className="flex flex-wrap gap-2">
                      <Input value={editDraft.theme || ""} onChange={ev => setEditDraft(d => ({ ...d, theme: ev.target.value }))} className="h-8 w-44" />
                      <Input type="date" value={editDraft.entry_date || ""} onChange={ev => setEditDraft(d => ({ ...d, entry_date: ev.target.value }))} className="h-8 w-40" />
                      <Input value={editDraft.title || ""} onChange={ev => setEditDraft(d => ({ ...d, title: ev.target.value }))} className="h-8 flex-1" />
                    </div>
                    <Textarea value={editDraft.content || ""} onChange={ev => setEditDraft(d => ({ ...d, content: ev.target.value }))} className="text-sm" />
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" onClick={saveEdit}><Check className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">{fmtDate(e.entry_date)}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5">{e.theme}</span>
                      <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditId(e.id); setEditDraft(e); }} className="hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(e.id)} className="hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <p className="text-sm font-medium mt-0.5">{e.title}</p>
                    {e.content && e.content !== e.title && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">{e.content}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
