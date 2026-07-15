import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Save } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { GoogleEvent } from "./types";

interface Props {
  event: GoogleEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

/** Dialog to edit/delete a Google Calendar event */
export function EditEventDialog({ event, open, onOpenChange, onChanged }: Props) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [allDay, setAllDay] = useState(false);

  useEffect(() => {
    if (!event) return;
    setSummary(event.summary || "");
    setDescription(event.description || "");
    setLocation(event.location || "");

    if (event.start?.dateTime) {
      const s = new Date(event.start.dateTime);
      setDate(format(s, "yyyy-MM-dd"));
      setStartTime(format(s, "HH:mm"));
      setEndTime(event.end?.dateTime ? format(new Date(event.end.dateTime), "HH:mm") : format(s, "HH:mm"));
      setAllDay(false);
    } else if (event.start?.date) {
      setDate(event.start.date);
      setStartTime("09:00");
      setEndTime("10:00");
      setAllDay(true);
    }
  }, [event]);

  const callApi = async (action: "update_event" | "delete_event", body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/google-calendar-api?action=${action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  };

  const handleSave = async () => {
    if (!event) return;
    if (!summary.trim()) {
      toast.error("Adicione um título");
      return;
    }
    setLoading(true);
    try {
      const start = allDay
        ? { date }
        : { dateTime: `${date}T${startTime}:00`, timeZone: "America/Sao_Paulo" };
      const end = allDay
        ? { date }
        : { dateTime: `${date}T${endTime}:00`, timeZone: "America/Sao_Paulo" };

      await callApi("update_event", {
        calendar_id: event.calendarId || "primary",
        event_id: event.id,
        summary: summary.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        start,
        end,
      });
      toast.success("Evento atualizado");
      onChanged?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar evento");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    if (!(await confirmDialog({ title: "Excluir evento", description: "Excluir este evento do Google Calendar?", destructive: true, confirmLabel: "Excluir" }))) return;
    setDeleting(true);
    try {
      await callApi("delete_event", {
        calendar_id: event.calendarId || "primary",
        event_id: event.id,
      });
      toast.success("Evento excluído");
      onChanged?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir evento");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Editar evento</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">Título</Label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Início</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Fim</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Dia inteiro
          </label>

          <div>
            <Label className="text-[11px] text-muted-foreground">Local</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 text-sm" placeholder="Opcional" />
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Descrição</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Opcional"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 gap-2">
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting || loading} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Trash2 className="h-3.5 w-3.5 mr-1" />Excluir</>}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading || deleting}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={loading || deleting} className="gradient-primary text-primary-foreground">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" />Salvar</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
