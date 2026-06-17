import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStudyAreas, useStudyTopics, type StudyTopic } from "@/hooks/useStudies";
import { Search } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "move" | "duplicate";
  currentTopicId: string;
  onConfirm: (topicId: string) => void | Promise<void>;
}

export function PickTopicDialog({ open, onOpenChange, mode, currentTopicId, onConfirm }: Props) {
  const { data: topics = [] } = useStudyTopics();
  const { data: areas = [] } = useStudyAreas();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (topics as StudyTopic[])
      .filter((t) => t.id !== currentTopicId)
      .filter((t) => !term || t.title.toLowerCase().includes(term) || (t.description ?? "").toLowerCase().includes(term));
  }, [topics, q, currentTopicId]);

  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? "—";

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    try { await onConfirm(selected); onOpenChange(false); setSelected(null); setQ(""); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setSelected(null); setQ(""); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "move" ? "Mover registro para outro tema" : "Duplicar registro em outro tema"}</DialogTitle>
          <DialogDescription>Selecione o tema de destino.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tema..." className="pl-8" autoFocus />
        </div>

        <div className="max-h-[320px] overflow-y-auto -mx-2 px-2 space-y-1">
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum tema encontrado.</p>
          ) : list.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                selected === t.id ? "border-foreground bg-muted" : "border-border hover:border-foreground/30 bg-card"
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{areaName(t.area_id)}</div>
              <div className="text-sm font-medium truncate">{t.title}</div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={confirm} disabled={!selected || busy}>
            {mode === "move" ? "Mover" : "Duplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
