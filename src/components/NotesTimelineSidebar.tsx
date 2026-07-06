import { useMemo } from "react";
import { parseNoteEntries, formatEntryRelative, formatMonthLabel } from "@/lib/noteEntries";
import { getBrtToday } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { X, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotesTimelineSidebarProps {
  notes: { id: string; content?: string | null }[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

interface Bucket {
  date: string;
  count: number;
}

export function NotesTimelineSidebar({ notes, selectedDate, onSelectDate }: NotesTimelineSidebarProps) {
  const today = getBrtToday();

  const grouped = useMemo(() => {
    const perDate = new Map<string, Set<string>>();
    for (const n of notes) {
      const entries = parseNoteEntries(n.content || "");
      for (const e of entries) {
        if (!perDate.has(e.date)) perDate.set(e.date, new Set());
        perDate.get(e.date)!.add(n.id);
      }
    }
    const buckets: Bucket[] = Array.from(perDate.entries())
      .map(([date, ids]) => ({ date, count: ids.size }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Group by month key (YYYY-MM)
    const months = new Map<string, Bucket[]>();
    for (const b of buckets) {
      const monthKey = b.date.slice(0, 7);
      if (!months.has(monthKey)) months.set(monthKey, []);
      months.get(monthKey)!.push(b);
    }
    return Array.from(months.entries()).map(([month, days]) => ({
      month,
      label: formatMonthLabel(`${month}-01`),
      days,
    }));
  }, [notes]);

  const totalDates = grouped.reduce((acc, g) => acc + g.days.length, 0);

  return (
    <aside className="w-[200px] flex-shrink-0 border-r border-border/60 bg-background/50 flex flex-col overflow-hidden">
      <div className="px-4 pt-5 pb-3 border-b border-border/60">
        <div className="flex items-center gap-1.5 mb-1">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Linha do tempo
          </h3>
        </div>
        <p className="text-[10.5px] text-muted-foreground/70">
          {totalDates} {totalDates === 1 ? "data" : "datas"} indexadas
        </p>
        {selectedDate && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-6 px-2 text-[10.5px] w-full justify-start gap-1.5"
            onClick={() => onSelectDate(null)}
          >
            <X className="h-3 w-3" />
            Limpar filtro
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {grouped.length === 0 && (
          <p className="px-1 text-[11px] text-muted-foreground/70 leading-relaxed">
            As datas aparecem aqui conforme você adiciona seções datadas nas notas.
          </p>
        )}
        {grouped.map((group) => (
          <section key={group.month} className="mb-5">
            <p className="px-1 mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.days.map((d) => {
                const isActive = selectedDate === d.date;
                return (
                  <li key={d.date}>
                    <button
                      type="button"
                      onClick={() => onSelectDate(isActive ? null : d.date)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors group",
                        isActive ? "bg-muted/70" : "hover:bg-muted/40",
                      )}
                    >
                      <span
                        className={cn(
                          "block w-[2px] h-4 rounded-full transition-colors",
                          isActive ? "bg-primary" : "bg-transparent group-hover:bg-border",
                        )}
                      />
                      <span
                        className={cn(
                          "text-[12px] tabular-nums flex-1",
                          isActive ? "font-semibold text-foreground" : "text-foreground/85",
                        )}
                      >
                        {formatEntryRelative(d.date, today)}
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-foreground/70">
                        {d.count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
