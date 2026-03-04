import { mockEvents } from "@/data/mockData";
import { Calendar as CalIcon } from "lucide-react";

export default function CalendarPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalIcon className="h-5 w-5 text-muted-foreground" /> Calendar
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Connect Google Calendar to sync your meetings</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="text-center py-8 space-y-3">
          <CalIcon className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="text-sm font-semibold">Google Calendar Integration</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Connect your Google account to sync meetings, create events from the AI assistant, and link tasks to calendar events.
          </p>
          <button className="text-xs text-primary font-medium hover:underline">
            Connect Google Calendar →
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Upcoming Events</h2>
        <div className="space-y-2">
          {mockEvents.map(event => {
            const start = new Date(event.startTime);
            const end = new Date(event.endTime);
            const dateStr = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            const timeStr = `${start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} – ${end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;

            return (
              <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card animate-fade-in">
                <div className="w-1 h-8 rounded-full gradient-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{dateStr} · {timeStr}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
