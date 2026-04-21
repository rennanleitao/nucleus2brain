/**
 * Reusable hourly timeline column for a single day.
 * Used both in the Day Planner (Timeline mode) and the Calendar Day view.
 *
 * Tasks/items WITHOUT a time appear in the "Sem horário" row at the top,
 * and can be dragged into any hour slot to assign a time.
 */
import { useDroppable } from "@dnd-kit/core";
import { format, isSameDay } from "date-fns";
import { Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarItemBlock } from "./CalendarItemChip";
import { QuickCreatePopover } from "./QuickCreatePopover";
import type { CalendarItem } from "./types";

interface Props {
  date: Date;
  items: CalendarItem[];
  hours?: number[];
  onCreateEvent?: (payload: { summary: string; date: string; startTime: string; endTime: string; description?: string; location?: string }) => Promise<void>;
  onRefresh?: () => void;
  onItemClick?: (item: CalendarItem) => void;
  /** Show the "Sem horário" droppable row at top (default true). */
  showUnscheduledRow?: boolean;
  /** Compact spacing (used inside Day Planner). */
  compact?: boolean;
}

const NOOP_EVENT = async () => { throw new Error("Eventos só podem ser criados no Calendar"); };

function HourSlot({
  d, hour, items, onCreateEvent, onRefresh, onItemClick, compact,
}: {
  d: Date; hour: number; items: CalendarItem[];
  onCreateEvent?: Props["onCreateEvent"]; onRefresh?: () => void; onItemClick?: Props["onItemClick"]; compact?: boolean;
}) {
  const droppable = useDroppable({
    id: `slot:${format(d, "yyyy-MM-dd")}:${hour}`,
    data: { date: d, hour },
  });
  const slotItems = items.filter((it) => {
    if (!isSameDay(it.date, d) || !it.time) return false;
    const [h] = it.time.split(":").map(Number);
    return h === hour;
  });
  const timeStr = `${String(hour).padStart(2, "0")}:00`;
  const minH = compact ? "min-h-[42px]" : "min-h-[56px]";

  return (
    <div
      ref={droppable.setNodeRef}
      className={`${minH} border-b border-border p-1.5 group relative transition-colors ${
        droppable.isOver ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/20"
      }`}
    >
      <div className="space-y-1">
        {slotItems.map((it, idx) => (
          <CalendarItemBlock key={`${it.kind}-${it.data.id}-${idx}`} item={it} onClick={() => onItemClick?.(it)} />
        ))}
      </div>
      {onCreateEvent && (
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
      )}
    </div>
  );
}

function UnscheduledRow({
  d, items, onItemClick,
}: { d: Date; items: CalendarItem[]; onItemClick?: Props["onItemClick"] }) {
  const droppable = useDroppable({
    id: `slot:${format(d, "yyyy-MM-dd")}:unscheduled`,
    data: { date: d, hour: null },
  });
  const unscheduled = items.filter((it) => isSameDay(it.date, d) && !it.time);

  return (
    <div
      ref={droppable.setNodeRef}
      className={`border-b border-border bg-muted/10 p-2 transition-colors ${
        droppable.isOver ? "bg-primary/10 ring-1 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">
          Sem horário {unscheduled.length > 0 && `(${unscheduled.length})`}
        </p>
      </div>
      {unscheduled.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/70 italic">Arraste aqui para remover horário</p>
      ) : (
        <div className="space-y-1">
          {unscheduled.map((it, idx) => (
            <CalendarItemBlock key={`${it.kind}-${it.data.id}-${idx}`} item={it} onClick={() => onItemClick?.(it)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TimelineView({
  date, items, hours, onCreateEvent, onRefresh, onItemClick, showUnscheduledRow = true, compact,
}: Props) {
  const HOURS = hours ?? Array.from({ length: 18 }, (_, i) => i + 6); // 6h - 23h

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {showUnscheduledRow && <UnscheduledRow d={date} items={items} onItemClick={onItemClick} />}
      <div className={`${compact ? "max-h-[60vh]" : "max-h-[65vh]"} overflow-y-auto`}>
        {HOURS.map((h) => (
          <div key={h} className="grid grid-cols-[60px_1fr]">
            <div className="p-2 text-[11px] text-muted-foreground text-right pr-3 border-r border-border">
              {String(h).padStart(2, "0")}:00
            </div>
            <HourSlot
              d={date}
              hour={h}
              items={items}
              onCreateEvent={onCreateEvent ?? (compact ? undefined : NOOP_EVENT)}
              onRefresh={onRefresh}
              onItemClick={onItemClick}
              compact={compact}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
