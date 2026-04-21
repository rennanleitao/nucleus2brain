import { useDroppable } from "@dnd-kit/core";
import { format, isSameDay, isSameMonth, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarItemChip } from "./CalendarItemChip";
import { QuickCreatePopover } from "./QuickCreatePopover";
import type { CalendarItem } from "./types";

interface Props {
  currentMonth: Date;
  items: CalendarItem[];
  onSelectDay: (d: Date) => void;
  onCreateEvent: (payload: { summary: string; date: string; startTime: string; endTime: string; description?: string; location?: string }) => Promise<void>;
  onRefresh: () => void;
  onItemClick?: (item: CalendarItem) => void;
}

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function DayCell({ d, currentMonth, items, onSelectDay, onCreateEvent, onRefresh, onItemClick }: { d: Date } & Omit<Props, "currentMonth" | "items"> & { currentMonth: Date; items: CalendarItem[] }) {
  const droppable = useDroppable({ id: `day:${format(d, "yyyy-MM-dd")}`, data: { date: d } });
  const isCurrentMonth = isSameMonth(d, currentMonth);
  const dayItems = items.filter((i) => isSameDay(i.date, d));

  return (
    <div
      ref={droppable.setNodeRef}
      onClick={() => onSelectDay(d)}
      className={`min-h-[96px] border-b border-r border-border p-1 cursor-pointer transition-colors group relative ${
        !isCurrentMonth ? "opacity-40" : ""
      } ${droppable.isOver ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/40"}`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <div className={`text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full ${
          isToday(d) ? "bg-primary text-primary-foreground" : "text-foreground"
        }`}>
          {format(d, "d")}
        </div>
        <QuickCreatePopover
          date={d}
          onCreateEvent={onCreateEvent}
          onCreated={onRefresh}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          }
        />
      </div>
      <div className="space-y-0.5">
        {dayItems.slice(0, 3).map((it, idx) => (
          <CalendarItemChip key={`${it.kind}-${it.data.id}-${idx}`} item={it} onClick={() => onItemClick?.(it)} />
        ))}
        {dayItems.length > 3 && (
          <p className="text-[10px] text-muted-foreground px-1">+{dayItems.length - 3} mais</p>
        )}
      </div>
    </div>
  );
}

export function MonthView(props: Props) {
  const { currentMonth, items } = props;
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

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {dayNames.map((n) => (
          <div key={n} className="p-2 text-center text-[11px] font-medium text-muted-foreground">{n}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => (
          <DayCell key={i} d={d} {...props} />
        ))}
      </div>
    </div>
  );
}
