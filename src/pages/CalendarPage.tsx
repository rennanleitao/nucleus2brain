import { useState, useEffect, useCallback } from "react";
import { Calendar as CalIcon, Plus, ChevronLeft, ChevronRight, Loader2, Unplug, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface GoogleCalendar {
  id: string;
  summary: string;
  backgroundColor: string;
  primary?: boolean;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  calendarId?: string;
  calendarColor?: string;
}

export default function CalendarPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<Record<string, boolean>>({});
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ summary: "", description: "", location: "", date: "", startTime: "09:00", endTime: "10:00" });

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  // Check connection status
  useEffect(() => {
    checkStatus();
    // Handle OAuth callback
    const params = new URLSearchParams(window.location.search);
    const tokenData = params.get("gcal_tokens");
    if (tokenData) {
      handleOAuthCallback(tokenData);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const checkStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await supabase.functions.invoke("google-calendar-api", {
        body: null,
        headers: { "Content-Type": "application/json" },
      });

      // Use fetch directly for query params
      const statusRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar-api?action=status`,
        { headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const statusData = await statusRes.json();
      setConnected(statusData.connected);
      setConnectedEmail(statusData.email);

      if (statusData.connected) {
        await loadCalendars(session.access_token);
      }
    } catch (err) {
      console.error(err);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (tokenData: string) => {
    try {
      const tokens = JSON.parse(atob(tokenData));
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar-auth?action=save_tokens`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(tokens),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast.success("Google Calendar conectado!");
      setConnected(true);
      setConnectedEmail(tokens.google_email);
      await loadCalendars(session.access_token);
    } catch (err: any) {
      toast.error("Erro ao conectar: " + err.message);
    }
  };

  const connectGoogle = async () => {
    try {
      const redirectUri = window.location.origin + "/calendar";
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar-auth?action=authorize&redirect_uri=${encodeURIComponent(redirectUri)}`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const disconnectGoogle = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar-auth?action=disconnect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      setConnected(false);
      setConnectedEmail(null);
      setCalendars([]);
      setEvents([]);
      setSelectedCalendars({});
      toast.success("Google Calendar desconectado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const loadCalendars = async (accessToken: string) => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar-api?action=list_calendars`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setCalendars(data);
        // Load saved selections from DB
        const { data: selections } = await supabase
          .from("google_calendar_selections")
          .select("calendar_id, enabled");

        const selMap: Record<string, boolean> = {};
        if (selections && selections.length > 0) {
          selections.forEach((s: any) => { selMap[s.calendar_id] = s.enabled; });
        } else {
          // Default: enable all
          data.forEach((c: GoogleCalendar) => { selMap[c.id] = true; });
        }
        setSelectedCalendars(selMap);
      }
    } catch (err) {
      console.error("Failed to load calendars:", err);
    }
  };

  // Load events when month or selected calendars change
  const loadEvents = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !connected) return;

    const enabledCals = Object.entries(selectedCalendars).filter(([, v]) => v).map(([k]) => k);
    if (enabledCals.length === 0) { setEvents([]); return; }

    setEventsLoading(true);
    try {
      const timeMin = startOfMonth(currentMonth).toISOString();
      const timeMax = endOfMonth(currentMonth).toISOString();
      const allEvents: GoogleEvent[] = [];

      await Promise.all(
        enabledCals.map(async (calId) => {
          const cal = calendars.find((c) => c.id === calId);
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/google-calendar-api?action=list_events&calendar_id=${encodeURIComponent(calId)}&time_min=${timeMin}&time_max=${timeMax}`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
            }
          );
          const data = await res.json();
          if (Array.isArray(data)) {
            data.forEach((e: GoogleEvent) => {
              allEvents.push({ ...e, calendarId: calId, calendarColor: cal?.backgroundColor });
            });
          }
        })
      );

      allEvents.sort((a, b) => {
        const aTime = a.start?.dateTime || a.start?.date || "";
        const bTime = b.start?.dateTime || b.start?.date || "";
        return aTime.localeCompare(bTime);
      });

      setEvents(allEvents);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setEventsLoading(false);
    }
  }, [connected, currentMonth, selectedCalendars, calendars, projectId]);

  useEffect(() => {
    if (connected) loadEvents();
  }, [connected, currentMonth, selectedCalendars, loadEvents]);

  const toggleCalendar = async (calId: string, calName: string, color: string | undefined) => {
    const newVal = !selectedCalendars[calId];
    setSelectedCalendars((prev) => ({ ...prev, [calId]: newVal }));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Upsert to DB - use raw query since types might not be generated yet
    await fetch(`https://${projectId}.supabase.co/rest/v1/google_calendar_selections`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        user_id: user.id,
        calendar_id: calId,
        calendar_name: calName,
        calendar_color: color,
        enabled: newVal,
      }),
    });
  };

  const createEvent = async () => {
    if (!newEvent.summary || !newEvent.date) { toast.error("Preencha título e data"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const startDT = `${newEvent.date}T${newEvent.startTime}:00`;
      const endDT = `${newEvent.date}T${newEvent.endTime}:00`;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar-api?action=create_event`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: newEvent.summary,
            description: newEvent.description,
            location: newEvent.location,
            start: { dateTime: startDT, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            end: { dateTime: endDT, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast.success("Evento criado!");
      setShowCreateEvent(false);
      setNewEvent({ summary: "", description: "", location: "", date: "", startTime: "09:00", endTime: "10:00" });
      loadEvents();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteEvent = async (eventId: string, calendarId?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar-api?action=delete_event`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ event_id: eventId, calendar_id: calendarId || "primary" }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast.success("Evento removido!");
      loadEvents();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Calendar grid rendering
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let day = gridStart;
  while (day <= gridEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const getEventsForDay = (d: Date) =>
    events.filter((e) => {
      const eventDate = e.start?.dateTime || e.start?.date || "";
      return isSameDay(new Date(eventDate), d);
    });

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not connected state
  if (!connected) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalIcon className="h-5 w-5 text-muted-foreground" /> Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Conecte o Google Calendar para sincronizar seus eventos</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-8">
          <div className="text-center py-8 space-y-4">
            <CalIcon className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-base font-semibold">Conectar Google Calendar</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Visualize, crie e gerencie eventos diretamente do Nucleus. Selecione quais calendários exibir.
            </p>
            <Button onClick={connectGoogle} className="gradient-primary text-primary-foreground">
              <CalIcon className="h-4 w-4 mr-2" /> Conectar Google Calendar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Connected state - full calendar
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalIcon className="h-5 w-5 text-muted-foreground" /> Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{connectedEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showCreateEvent} onOpenChange={setShowCreateEvent}>
            <DialogTrigger asChild>
              <Button size="sm" className="gradient-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-1" /> Novo Evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Evento</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <Label>Título</Label>
                  <Input value={newEvent.summary} onChange={(e) => setNewEvent((p) => ({ ...p, summary: e.target.value }))} placeholder="Nome do evento" />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={newEvent.date} onChange={(e) => setNewEvent((p) => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Início</Label>
                    <Input type="time" value={newEvent.startTime} onChange={(e) => setNewEvent((p) => ({ ...p, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Fim</Label>
                    <Input type="time" value={newEvent.endTime} onChange={(e) => setNewEvent((p) => ({ ...p, endTime: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Local</Label>
                  <Input value={newEvent.location} onChange={(e) => setNewEvent((p) => ({ ...p, location: e.target.value }))} placeholder="Opcional" />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input value={newEvent.description} onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))} placeholder="Opcional" />
                </div>
                <Button onClick={createEvent} className="w-full">Criar Evento</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Calendários</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">Selecione quais calendários exibir:</p>
                {calendars.map((cal) => (
                  <div key={cal.id} className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedCalendars[cal.id] ?? true}
                      onCheckedChange={() => toggleCalendar(cal.id, cal.summary, cal.backgroundColor)}
                    />
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: cal.backgroundColor }}
                    />
                    <span className="text-sm truncate">{cal.summary}</span>
                    {cal.primary && <span className="text-xs text-muted-foreground">(principal)</span>}
                  </div>
                ))}
                <div className="pt-3 border-t border-border">
                  <Button variant="destructive" size="sm" onClick={disconnectGoogle}>
                    <Unplug className="h-4 w-4 mr-1" /> Desconectar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {dayNames.map((name) => (
            <div key={name} className="p-2 text-center text-xs font-medium text-muted-foreground">
              {name}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const dayEvents = getEventsForDay(d);
            const isCurrentMonth = isSameMonth(d, currentMonth);
            const isSelected = selectedDate && isSameDay(d, selectedDate);

            return (
              <div
                key={i}
                className={`min-h-[90px] border-b border-r border-border p-1 cursor-pointer transition-colors hover:bg-muted/50 ${
                  !isCurrentMonth ? "opacity-40" : ""
                } ${isSelected ? "bg-primary/10" : ""}`}
                onClick={() => {
                  setSelectedDate(d);
                  setNewEvent((p) => ({ ...p, date: format(d, "yyyy-MM-dd") }));
                }}
              >
                <div
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mx-auto ${
                    isToday(d) ? "bg-primary text-primary-foreground" : ""
                  }`}
                >
                  {format(d, "d")}
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className="text-[10px] leading-tight truncate rounded px-1 py-px"
                      style={{
                        backgroundColor: (ev.calendarColor || "hsl(var(--primary))") + "33",
                        borderLeft: `2px solid ${ev.calendarColor || "hsl(var(--primary))"}`,
                      }}
                      title={ev.summary}
                    >
                      {ev.start?.dateTime && (
                        <span className="font-medium">
                          {format(new Date(ev.start.dateTime), "HH:mm")}{" "}
                        </span>
                      )}
                      {ev.summary || "(Sem título)"}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{dayEvents.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNewEvent((p) => ({ ...p, date: format(selectedDate, "yyyy-MM-dd") }));
                setShowCreateEvent(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Evento
            </Button>
          </div>
          {eventsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              {getEventsForDay(selectedDate).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento neste dia.</p>
              ) : (
                <div className="space-y-2">
                  {getEventsForDay(selectedDate).map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"
                      style={{ borderLeftColor: ev.calendarColor, borderLeftWidth: 3 }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{ev.summary || "(Sem título)"}</p>
                        {ev.start?.dateTime && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(ev.start.dateTime), "HH:mm")}
                            {ev.end?.dateTime && ` – ${format(new Date(ev.end.dateTime), "HH:mm")}`}
                          </p>
                        )}
                        {ev.location && <p className="text-xs text-muted-foreground mt-0.5">📍 {ev.location}</p>}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteEvent(ev.id, ev.calendarId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
