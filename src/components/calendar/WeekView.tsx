import { useDroppable } from "@dnd-kit/core";
import { format, isSameDay, isToday, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarItemBlock } from "./CalendarItemChip";
import { QuickCreatePopover } from "./QuickCreatePopover";
import type { CalendarItem } from "./types";

interface Props {
  currentDate: Date;
  items: CalendarItem[];
  onSelectDay: (d: Date) => void;
  onCreateEvent: (payload: { summary: string; date: string; startTime: string; endTime: string; description?: string; location?: string }) => Promise<void>;
  onRefresh: () => void;
  onItemClick?: (item: CalendarItem) => void;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7h - 20h

function getItemHour(it: CalendarItem): number | null {
  if (!it.time) return null;
  const [h] = it.time.split(":").map(Number);
  return h;
}

function HourSlot({ d, hour, items, onCreateEvent, onRefresh, onItemClick }: { d: Date; hour: number; items: CalendarItem[] } & Pick<Props, "onCreateEvent" | "onRefresh" | "onItemClick">) {
  const droppable = useDroppable({ id: `slot:${format(d, "yyyy-MM-dd")}:${hour}`, data: { date: d, hour } });
  const slotItems = items.filter((it) => isSameDay(it.date, d) && getItemHour(it) === hour);
  const timeStr = `${String(hour).padStart(2, "0")}:00`;

  return (
    <div
      ref={droppable.setNodeRef}
      className={`min-h-[48px] border-b border-r border-border p-1 group relative transition-colors ${
        droppable.isOver ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/30"
      }`}
    >
      <div className="space-y-0.5">
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
          <Button variant="ghost" size="icon" className="h-4 w-4 absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100">
            <Plus className="h-3 w-3" />
          </Button>
        }
      />
    </div>
  );
}

function AllDayRow({ d, items, onItemClick }: { d: Date; items: CalendarItem[]; onItemClick?: (i: CalendarItem) => void }) {
  const allDay = items.filter((it) => isSameDay(it.date, d) && !it.time);
  if (allDay.length === 0) return <div className="min-h-[24px] border-b border-r border-border" />;
  return (
    <div className="min-h-[24px] border-b border-r border-border p-0.5 space-y-0.5">
      {allDay.map((it, idx) => (
        <CalendarItemBlock key={`${it.kind}-${it.data.id}-${idx}`} item={it} onClick={() => onItemClick?.(it)} />
      ))}
    </div>
  );
}

export function WeekView({ currentDate, items, onCreateEvent, onRefresh, onItemClick }: Props) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/20">
        <div className="p-2 text-[10px] text-muted-foreground text-center">UTC</div>
        {days.map((d, i) => (
          <div key={i} className={`p-2 text-center border-l border-border ${isToday(d) ? "text-primary font-semibold" : ""}`}>
            <div className="text-[10px] uppercase text-muted-foreground">{format(d, "EEE", { locale: ptBR })}</div>
            <div className={`text-sm font-medium ${isToday(d) ? "" : "text-foreground"}`}>{format(d, "d")}</div>
          </div>
        ))}
      </div>

      {/* All-day row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/10">
        <div className="p-1 text-[10px] text-muted-foreground text-right pr-2">all-day</div>
        {days.map((d, i) => (
          <AllDayRow key={i} d={d} items={items} onItemClick={onItemClick} />
        ))}
      </div>

      {/* Hours grid */}
      <div className="max-h-[60vh] overflow-y-auto">
        {HOURS.map((h) => (
          <div key={h} className="grid grid-cols-[60px_repeat(7,1fr)]">
            <div className="p-1 text-[10px] text-muted-foreground text-right pr-2 border-b border-r border-border">
              {String(h).padStart(2, "0")}:00
            </div>
            {days.map((d, i) => (
              <HourSlot key={i} d={d} hour={h} items={items} onCreateEvent={onCreateEvent} onRefresh={onRefresh} onItemClick={onItemClick} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
