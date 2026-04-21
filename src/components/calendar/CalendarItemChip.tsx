import { useDraggable } from "@dnd-kit/core";
import { Bell, ListChecks, Calendar as CalIcon } from "lucide-react";
import type { CalendarItem } from "./types";
import { format } from "date-fns";

interface Props {
  item: CalendarItem;
  onClick?: () => void;
}

/** Compact draggable chip used inside month/week cells */
export function CalendarItemChip({ item, onClick }: Props) {
  const isTask = item.kind === "task";
  const draggable = useDraggable({
    id: `${item.kind}:${item.data.id}`,
    disabled: !isTask, // only tasks are draggable
    data: { item },
  });

  if (isTask) {
    const t = item.data;
    const priorityRing =
      t.priority === "high" ? "border-l-destructive" :
      t.priority === "low" ? "border-l-muted-foreground" :
      "border-l-primary";
    return (
      <button
        ref={draggable.setNodeRef}
        {...draggable.listeners}
        {...draggable.attributes}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        className={`w-full flex items-center gap-1 text-[10px] leading-tight rounded px-1 py-0.5 bg-muted/60 hover:bg-muted border-l-2 ${priorityRing} truncate text-left ${draggable.isDragging ? "opacity-40" : ""} cursor-grab active:cursor-grabbing`}
        style={draggable.transform ? { transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)` } : undefined}
        title={t.title}
      >
        <ListChecks className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{t.title}</span>
        {t.hasReminder && <Bell className="h-2.5 w-2.5 shrink-0 text-primary ml-auto" />}
      </button>
    );
  }

  const ev = item.data;
  const color = ev.calendarColor || "hsl(var(--primary))";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="w-full flex items-center gap-1 text-[10px] leading-tight truncate rounded px-1 py-0.5 text-left hover:opacity-80"
      style={{ backgroundColor: color + "33", borderLeft: `2px solid ${color}` }}
      title={ev.summary}
    >
      <CalIcon className="h-2.5 w-2.5 shrink-0" style={{ color }} />
      {item.time && <span className="font-medium shrink-0">{item.time}</span>}
      <span className="truncate">{ev.summary || "(Sem título)"}</span>
    </button>
  );
}

/** Larger time-block used in week/day views */
export function CalendarItemBlock({ item, onClick }: Props) {
  const isTask = item.kind === "task";
  const draggable = useDraggable({
    id: `${item.kind}:${item.data.id}`,
    disabled: !isTask,
    data: { item },
  });

  if (isTask) {
    const t = item.data;
    const ring =
      t.priority === "high" ? "border-destructive/50 bg-destructive/10" :
      t.priority === "low" ? "border-border bg-muted/40" :
      "border-primary/30 bg-primary/10";
    return (
      <button
        ref={draggable.setNodeRef}
        {...draggable.listeners}
        {...draggable.attributes}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        className={`w-full text-left rounded-md border ${ring} p-1.5 text-xs hover:shadow-sm transition-shadow cursor-grab active:cursor-grabbing ${draggable.isDragging ? "opacity-40" : ""}`}
        style={draggable.transform ? { transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)` } : undefined}
      >
        <div className="flex items-center gap-1">
          <ListChecks className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="font-medium truncate flex-1">{t.title}</span>
          {t.hasReminder && <Bell className="h-3 w-3 text-primary shrink-0" />}
        </div>
        {t.spaces?.name && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.spaces.name}</p>}
      </button>
    );
  }

  const ev = item.data;
  const color = ev.calendarColor || "hsl(var(--primary))";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="w-full text-left rounded-md border p-1.5 text-xs hover:shadow-sm transition-shadow"
      style={{ backgroundColor: color + "20", borderColor: color + "60" }}
      title={ev.summary}
    >
      <div className="flex items-center gap-1">
        <CalIcon className="h-3 w-3 shrink-0" style={{ color }} />
        <span className="font-medium truncate flex-1">{ev.summary || "(Sem título)"}</span>
      </div>
      {item.time && (
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {item.time}
          {ev.end?.dateTime && ` – ${format(new Date(ev.end.dateTime), "HH:mm")}`}
        </p>
      )}
      {ev.location && <p className="text-[10px] text-muted-foreground truncate">📍 {ev.location}</p>}
    </button>
  );
}
