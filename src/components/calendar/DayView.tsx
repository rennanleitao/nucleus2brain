import { useDroppable } from "@dnd-kit/core";
import { format, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarItemBlock } from "./CalendarItemChip";
import { QuickCreatePopover } from "./QuickCreatePopover";
import type { CalendarItem } from "./types";

interface Props {
  currentDate: Date;
  items: CalendarItem[];
  onCreateEvent: (payload: { summary: string; date: string; startTime: string; endTime: string; description?: string; location?: string }) => Promise<void>;
  onRefresh: () => void;
  onItemClick?: (item: CalendarItem) => void;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6h - 23h

function HourSlot({ d, hour, items, onCreateEvent, onRefresh, onItemClick }: { d: Date; hour: number; items: CalendarItem[] } & Pick<Props, "onCreateEvent" | "onRefresh" | "onItemClick">) {
  const droppable = useDroppable({ id: `slot:${format(d, "yyyy-MM-dd")}:${hour}`, data: { date: d, hour } });
  const slotItems = items.filter((it) => {
    if (!isSameDay(it.date, d) || !it.time) return false;
    const [h] = it.time.split(":").map(Number);
    return h === hour;
  });
  const timeStr = `${String(hour).padStart(2, "0")}:00`;

  return (
    <div
      ref={droppable.setNodeRef}
      className={`min-h-[56px] border-b border-border p-1.5 group relative transition-colors ${
        droppable.isOver ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/30"
      }`}
    >
      <div className="space-y-1">
        {slotItems.map((it, idx) => (
          <CalendarItemBlock key={`${it.kind}-${it.data.id}-${idx}`} item={it} onClick={() => onItemClick?.(it)} />
        ))}
      </div>
      <QuickCreatePopover
        date={d}
        defaultTime={timeStr}
        onCreateEvent={onCreateEvent}
        onCreated={onRefresh}
        trigger={
          <Button variant="ghost" size="icon" className="h-5 w-5 absolute top-1 right-1 opacity-0 group-hover:opacity-100">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        }
      />
    </div>
  );
}

export function DayView({ currentDate, items, onCreateEvent, onRefresh, onItemClick }: Props) {
  const allDay = items.filter((it) => isSameDay(it.date, currentDate) && !it.time);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className={`p-3 border-b border-border ${isToday(currentDate) ? "bg-primary/5" : ""}`}>
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{format(currentDate, "EEEE", { locale: ptBR })}</p>
        <p className={`text-2xl font-bold ${isToday(currentDate) ? "text-primary" : "text-foreground"}`}>{format(currentDate, "d 'de' MMMM", { locale: ptBR })}</p>
      </div>

      {allDay.length > 0 && (
        <div className="border-b border-border bg-muted/10 p-2 space-y-1">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Dia inteiro</p>
          {allDay.map((it, idx) => (
            <CalendarItemBlock key={`${it.kind}-${it.data.id}-${idx}`} item={it} onClick={() => onItemClick?.(it)} />
          ))}
        </div>
      )}

      <div className="max-h-[65vh] overflow-y-auto">
        {HOURS.map((h) => (
          <div key={h} className="grid grid-cols-[60px_1fr]">
            <div className="p-2 text-[11px] text-muted-foreground text-right pr-3 border-r border-border">
              {String(h).padStart(2, "0")}:00
            </div>
            <HourSlot d={currentDate} hour={h} items={items} onCreateEvent={onCreateEvent} onRefresh={onRefresh} onItemClick={onItemClick} />
          </div>
        ))}
      </div>
    </div>
  );
}
