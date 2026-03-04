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
          <p className="text-xs text-muted-foreground">Coming soon — use the AI Assistant to manage your schedule for now.</p>
        </div>
      </div>
    </div>
  );
}
