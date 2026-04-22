import { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar as CalIcon, ChevronLeft, ChevronRight, Loader2, Unplug, Settings2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  addMonths, subMonths, addWeeks, subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

import { MonthView } from "@/components/calendar/MonthView";
import { WeekView } from "@/components/calendar/WeekView";
import { DayView } from "@/components/calendar/DayView";
import { QuickCreatePopover } from "@/components/calendar/QuickCreatePopover";
import { AISchedulePreviewDialog } from "@/components/AISchedulePreviewDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { EditEventDialog } from "@/components/calendar/EditEventDialog";
import { fetchSpaces } from "@/lib/api";
import { isSameDay } from "date-fns";
import type { GoogleCalendar, GoogleEvent, CalendarTask, CalendarItem, CalendarView } from "@/components/calendar/types";

export default function CalendarPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<Record<string, boolean>>({});
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAISchedule, setShowAISchedule] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [editingEvent, setEditingEvent] = useState<GoogleEvent | null>(null);
  const [spacesList, setSpacesList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchSpaces().then((s) => setSpacesList(s as any)).catch(() => {});
  }, []);

  const handleItemClick = useCallback(async (item: CalendarItem) => {
    if (item.kind === "event") {
      setEditingEvent(item.data);
      return;
    }
    // Task — fetch full record so EditTaskDialog has all fields
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", item.data.id)
      .maybeSingle();
    if (error || !data) {
      toast.error("Erro ao abrir tarefa");
      return;
    }
    setEditingTask(data);
  }, []);


  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Range visible in current view
  const range = useMemo(() => {
    if (view === "month") {
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      return { start: startOfWeek(ms, { weekStartsOn: 0 }), end: endOfWeek(me, { weekStartsOn: 0 }) };
    }
    if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      return { start: ws, end: addDays(ws, 6) };
    }
    return { start: currentDate, end: currentDate };
  }, [view, currentDate]);

  // ----- Connection check -----
  useEffect(() => {
    checkStatus();
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
      if (!session) { setLoading(false); return; }

      const statusRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar-api?action=status`,
        { headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const statusData = await statusRes.json();
      setConnected(statusData.connected);
      setConnectedEmail(statusData.email);
      if (statusData.connected) await loadCalendars(session.access_token);
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
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(tokens) }
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
      if (data.url) window.location.href = data.url;
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
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      setConnected(false); setConnectedEmail(null); setCalendars([]); setEvents([]); setSelectedCalendars({});
      toast.success("Google Calendar desconectado");
    } catch (err: any) { toast.error(err.message); }
  };

  const loadCalendars = async (accessToken: string) => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar-api?action=list_calendars`,
        { headers: { Authorization: `Bearer ${accessToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setCalendars(data);
        const { data: selections } = await supabase.from("google_calendar_selections").select("calendar_id, enabled");
        const selMap: Record<string, boolean> = {};
        if (selections && selections.length > 0) {
          selections.forEach((s: any) => { selMap[s.calendar_id] = s.enabled; });
        } else {
          data.forEach((c: GoogleCalendar) => { selMap[c.id] = true; });
        }
        setSelectedCalendars(selMap);
      }
    } catch (err) { console.error("Failed to load calendars:", err); }
  };

  // ----- Load events + tasks for current range -----
  const loadData = useCallback(async () => {
    setEventsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const timeMin = range.start.toISOString();
      const timeMax = range.end.toISOString();

      // Tasks (always fetched, even without google connected)
      const tasksReq = supabase
        .from("tasks")
        .select("id, title, due_date, scheduled_time, status, priority, space_id, estimated_minutes, spaces(name)")
        .not("due_date", "is", null)
        .gte("due_date", format(range.start, "yyyy-MM-dd"))
        .lte("due_date", format(range.end, "yyyy-MM-dd"))
        .neq("status", "completed")
        .neq("status", "cancelled");

      // Reminders for those tasks
      const remindersReq = supabase
        .from("reminders")
        .select("task_id")
        .eq("sent", false);

      const eventsPromise: Promise<GoogleEvent[]> = (async () => {
        if (!connected || !session) return [];
        const enabledCals = Object.entries(selectedCalendars).filter(([, v]) => v).map(([k]) => k);
        if (enabledCals.length === 0) return [];
        const all: GoogleEvent[] = [];
        await Promise.all(enabledCals.map(async (calId) => {
          const cal = calendars.find((c) => c.id === calId);
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/google-calendar-api?action=list_events&calendar_id=${encodeURIComponent(calId)}&time_min=${timeMin}&time_max=${timeMax}`,
            { headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
          );
          const data = await res.json();
          if (Array.isArray(data)) {
            data.forEach((e: GoogleEvent) => all.push({ ...e, calendarId: calId, calendarColor: cal?.backgroundColor }));
          }
        }));
        return all;
      })();

      const [tasksRes, remindersRes, eventsRes] = await Promise.all([tasksReq, remindersReq, eventsPromise]);
      const reminderTaskIds = new Set((remindersRes.data || []).map((r: any) => r.task_id).filter(Boolean));
      const enrichedTasks: CalendarTask[] = ((tasksRes.data as any) || []).map((t: any) => ({
        ...t,
        hasReminder: reminderTaskIds.has(t.id),
      }));
      setTasks(enrichedTasks);
      setEvents(eventsRes);
    } catch (err) {
      console.error(err);
    } finally {
      setEventsLoading(false);
    }
  }, [range.start, range.end, connected, selectedCalendars, calendars, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ----- Combined items -----
  const items: CalendarItem[] = useMemo(() => {
    const evItems: CalendarItem[] = events.map((e) => {
      const dt = e.start?.dateTime || e.start?.date || "";
      const date = new Date(dt);
      const time = e.start?.dateTime ? format(date, "HH:mm") : null;
      return { kind: "event", data: e, date, time };
    });
    const tkItems: CalendarItem[] = tasks
      .filter((t) => t.due_date)
      .map((t) => {
        // due_date is a YYYY-MM-DD string — parse as local
        const [y, m, d] = (t.due_date as string).split("-").map(Number);
        const time = t.scheduled_time ? (t.scheduled_time as string).slice(0, 5) : null;
        return { kind: "task", data: t, date: new Date(y, m - 1, d), time };
      });
    return [...evItems, ...tkItems];
  }, [events, tasks]);

  // ----- Calendar selection toggle -----
  const toggleCalendar = async (calId: string, calName: string, color: string | undefined) => {
    const newVal = !selectedCalendars[calId];
    setSelectedCalendars((prev) => ({ ...prev, [calId]: newVal }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await fetch(`https://${projectId}.supabase.co/rest/v1/google_calendar_selections`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ user_id: user.id, calendar_id: calId, calendar_name: calName, calendar_color: color, enabled: newVal }),
    });
  };

  // ----- Create event (used by popovers) -----
  const createEventApi = async (payload: { summary: string; date: string; startTime: string; endTime: string; description?: string; location?: string }) => {
    if (!connected) {
      toast.error("Conecte o Google Calendar primeiro");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const startDT = `${payload.date}T${payload.startTime}:00`;
    const endDT = `${payload.date}T${payload.endTime}:00`;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/google-calendar-api?action=create_event`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: payload.summary,
          description: payload.description,
          location: payload.location,
          start: { dateTime: startDT, timeZone: "America/Sao_Paulo" },
          end: { dateTime: endDT, timeZone: "America/Sao_Paulo" },
        }),
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    toast.success("Evento criado!");
  };

  // ----- Drag end → update task due_date and/or scheduled_time -----
  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    if (!id.startsWith("task:")) return;
    const taskId = id.slice("task:".length);
    const overData = over.data.current as { date?: Date; hour?: number | null } | undefined;
    if (!overData?.date) return;
    const newDate = format(overData.date, "yyyy-MM-dd");
    const newTime = overData.hour == null ? null : `${String(overData.hour).padStart(2, "0")}:00`;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const currentTime = task.scheduled_time ? (task.scheduled_time as string).slice(0, 5) : null;
    if (task.due_date === newDate && currentTime === newTime) return;

    // Optimistic
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, due_date: newDate, scheduled_time: newTime } : t)));
    const { error } = await supabase
      .from("tasks")
      .update({ due_date: newDate, scheduled_time: newTime })
      .eq("id", taskId);
    if (error) {
      toast.error("Erro ao mover task");
      loadData(); // revert
    } else {
      toast.success(newTime ? `Task agendada para ${newTime}` : "Task movida");
    }
  };

  // ----- Navigation -----
  const navPrev = () => {
    if (view === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -1));
  };
  const navNext = () => {
    if (view === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };
  const navToday = () => setCurrentDate(new Date());

  const titleLabel = useMemo(() => {
    if (view === "month") return format(currentDate, "MMMM yyyy", { locale: ptBR });
    if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = addDays(ws, 6);
      return `${format(ws, "d MMM", { locale: ptBR })} – ${format(we, "d MMM yyyy", { locale: ptBR })}`;
    }
    return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
  }, [view, currentDate]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title flex items-center gap-2">
            <CalIcon className="h-5 w-5 text-muted-foreground" /> Calendar
          </h1>
          <p className="text-micro text-muted-foreground mt-0.5">
            {connected ? connectedEmail : "Tasks e lembretes (conecte o Google para ver eventos)"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
            <TabsList className="h-8">
              <TabsTrigger value="month" className="text-xs px-3">Mês</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3">Semana</TabsTrigger>
              <TabsTrigger value="day" className="text-xs px-3">Dia</TabsTrigger>
            </TabsList>
          </Tabs>

          {view === "day" && (
            <Button size="sm" variant="outline" onClick={() => setShowAISchedule(true)} className="h-8 gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Sugerir IA
            </Button>
          )}

          <QuickCreatePopover
            date={currentDate}
            onCreateEvent={createEventApi}
            onCreated={loadData}
            trigger={
              <Button size="sm" className="gradient-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-1" /> Novo
              </Button>
            }
          />

          {connected ? (
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Calendários</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-muted-foreground">Selecione quais calendários exibir:</p>
                  {calendars.map((cal) => (
                    <div key={cal.id} className="flex items-center gap-3">
                      <Checkbox checked={selectedCalendars[cal.id] ?? true} onCheckedChange={() => toggleCalendar(cal.id, cal.summary, cal.backgroundColor)} />
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cal.backgroundColor }} />
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
          ) : (
            <Button size="sm" variant="outline" onClick={connectGoogle}>
              <CalIcon className="h-4 w-4 mr-1" /> Conectar Google
            </Button>
          )}
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={navToday} className="h-8 text-xs">Hoje</Button>
          <Button variant="ghost" size="sm" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <h2 className="text-base md:text-lg font-semibold capitalize">{titleLabel}</h2>
        <div className="flex items-center gap-2 min-w-[80px] justify-end">
          {eventsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* View body */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {view === "month" && (
          <MonthView
            currentMonth={currentDate}
            items={items}
            onSelectDay={(d) => { setCurrentDate(d); setView("day"); }}
            onCreateEvent={createEventApi}
            onRefresh={loadData}
          />
        )}
        {view === "week" && (
          <WeekView
            currentDate={currentDate}
            items={items}
            onSelectDay={(d) => { setCurrentDate(d); setView("day"); }}
            onCreateEvent={createEventApi}
            onRefresh={loadData}
          />
        )}
        {view === "day" && (
          <DayView
            currentDate={currentDate}
            items={items}
            onCreateEvent={createEventApi}
            onRefresh={loadData}
          />
        )}
      </DndContext>

      <AISchedulePreviewDialog
        open={showAISchedule}
        onOpenChange={setShowAISchedule}
        date={format(currentDate, "yyyy-MM-dd")}
        tasks={tasks
          .filter((t) => t.due_date === format(currentDate, "yyyy-MM-dd"))
          .map((t) => ({
            id: t.id,
            title: t.title,
            priority: t.priority as any,
            estimated_minutes: t.estimated_minutes,
            scheduled_time: (t as any).scheduled_time,
          }))}
        busy={events
          .filter((e) => {
            const dt = e.start?.dateTime;
            return dt && isSameDay(new Date(dt), currentDate);
          })
          .map((e) => ({
            summary: e.summary,
            start: format(new Date(e.start!.dateTime!), "HH:mm"),
            end: e.end?.dateTime ? format(new Date(e.end.dateTime), "HH:mm") : format(new Date(e.start!.dateTime!), "HH:mm"),
          }))}
        onApplied={loadData}
      />
    </div>
  );
}
