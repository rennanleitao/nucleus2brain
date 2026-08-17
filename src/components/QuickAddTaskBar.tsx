import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Mic, MicOff, Plus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { createTask } from "@/lib/api";
import { useHelenaSpeechInput } from "@/hooks/useHelenaSpeechInput";
import { getBrtToday, getBrtTomorrow, addDaysBrt } from "@/lib/timezone";
import { cn } from "@/lib/utils";

interface Props {
  spaces: { id: string; name: string }[];
  onCreated?: () => void;
  /** Opens the full task dialog for advanced fields */
  onOpenFull?: () => void;
}

function labelForDate(date: string | null) {
  if (!date) return "Data";
  if (date === getBrtToday()) return "Hoje";
  if (date === getBrtTomorrow()) return "Amanhã";
  const [y, m, d] = date.split("-");
  return `${d}/${m}`;
}

export function QuickAddTaskBar({ spaces, onCreated, onOpenFull }: Props) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(getBrtToday());
  const [spaceId, setSpaceId] = useState<string>("none");
  const [saving, setSaving] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [showFields, setShowFields] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const speech = useHelenaSpeechInput();

  useEffect(() => {
    if (speech.isListening && speech.transcript) setTitle(speech.transcript);
  }, [speech.isListening, speech.transcript]);

  useEffect(() => {
    if (speech.error) toast.error(speech.error);
  }, [speech.error]);

  const toggleMic = () => {
    if (speech.isListening) {
      const text = speech.stop();
      if (text) setTitle(text);
      inputRef.current?.focus();
      return;
    }
    setShowFields(true);
    speech.start();
  };

  const submit = async () => {
    const value = title.trim();
    if (!value) {
      inputRef.current?.focus();
      return;
    }
    if (speech.isListening) speech.abort();
    setSaving(true);
    try {
      await createTask({
        title: value,
        status: "todo" as any,
        priority: "medium",
        due_date: dueDate,
        space_id: spaceId === "none" ? null : spaceId,
      } as any);
      setTitle("");
      speech.resetTranscript();
      toast.success("Task criada");
      onCreated?.();
      inputRef.current?.focus();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar task");
    } finally {
      setSaving(false);
    }
  };

  const hasContent = title.trim().length > 0;

  return (
    <div className="rounded-xl border border-border bg-card px-2.5 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMic}
          title={speech.isListening ? "Parar captura de voz" : "Adicionar por voz"}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
            speech.isListening
              ? "border-destructive/40 bg-destructive/10 text-destructive animate-pulse"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {speech.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <Input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onFocus={() => setShowFields(true)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
            if (e.key === "Escape") { setTitle(""); setShowFields(false); }
          }}
          placeholder={speech.isListening ? "Ouvindo..." : "Adicionar tarefa rápida..."}
          className="h-9 flex-1 border-0 bg-transparent px-1 text-small shadow-none focus-visible:ring-0"
        />

        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={saving || !hasContent}
          className="h-9 shrink-0 gap-1"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Add</span>
        </Button>
      </div>

      {showFields && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-small font-normal">
                <CalendarIcon className="h-3.5 w-3.5" />
                {labelForDate(dueDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <div className="flex gap-1 border-b border-border p-2">
                <Button variant="ghost" size="sm" className="h-7 text-micro" onClick={() => { setDueDate(getBrtToday()); setDateOpen(false); }}>Hoje</Button>
                <Button variant="ghost" size="sm" className="h-7 text-micro" onClick={() => { setDueDate(getBrtTomorrow()); setDateOpen(false); }}>Amanhã</Button>
                <Button variant="ghost" size="sm" className="h-7 text-micro" onClick={() => { setDueDate(addDaysBrt(getBrtToday(), 7)); setDateOpen(false); }}>+7d</Button>
                <Button variant="ghost" size="sm" className="h-7 text-micro" onClick={() => { setDueDate(null); setDateOpen(false); }}>Sem data</Button>
              </div>
              <Calendar
                mode="single"
                selected={dueDate ? new Date(`${dueDate}T12:00:00`) : undefined}
                onSelect={(d) => {
                  if (!d) return;
                  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  setDueDate(iso);
                  setDateOpen(false);
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Select value={spaceId} onValueChange={setSpaceId}>
            <SelectTrigger className="h-8 w-[150px] text-small"><SelectValue placeholder="Space" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem space</SelectItem>
              {spaces.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {onOpenFull && (
            <button
              type="button"
              onClick={onOpenFull}
              className="ml-auto flex items-center gap-1 text-micro text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Mais opções
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFields(false)}
            title="Recolher"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
