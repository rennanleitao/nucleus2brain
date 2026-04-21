import { TimelineView } from "./TimelineView";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CalendarItem } from "./types";

interface Props {
  currentDate: Date;
  items: CalendarItem[];
  onCreateEvent: (payload: { summary: string; date: string; startTime: string; endTime: string; description?: string; location?: string }) => Promise<void>;
  onRefresh: () => void;
  onItemClick?: (item: CalendarItem) => void;
}

export function DayView({ currentDate, items, onCreateEvent, onRefresh, onItemClick }: Props) {
  return (
    <div className="space-y-3">
      <div className={`p-3 rounded-xl border border-border bg-card ${isToday(currentDate) ? "ring-1 ring-primary/30" : ""}`}>
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{format(currentDate, "EEEE", { locale: ptBR })}</p>
        <p className={`text-2xl font-bold ${isToday(currentDate) ? "text-primary" : "text-foreground"}`}>
          {format(currentDate, "d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      <TimelineView
        date={currentDate}
        items={items}
        onCreateEvent={onCreateEvent}
        onRefresh={onRefresh}
        onItemClick={onItemClick}
      />
    </div>
  );
}
