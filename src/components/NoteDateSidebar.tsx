import { useEffect, useMemo, useState } from "react";
import { parseNoteEntries, formatEntryShort, formatEntryRelative, entryIdForDate } from "@/lib/noteEntries";
import { getBrtToday } from "@/lib/timezone";
import { cn } from "@/lib/utils";

interface NoteDateSidebarProps {
  html: string;
  scrollContainer?: HTMLElement | null;
  onJump: (date: string) => void;
}

export function NoteDateSidebar({ html, scrollContainer, onJump }: NoteDateSidebarProps) {
  const entries = useMemo(() => parseNoteEntries(html), [html]);
  const today = getBrtToday();
  const [activeDate, setActiveDate] = useState<string | null>(null);

  // Scroll-spy: figure out which entry heading is currently in view.
  useEffect(() => {
    if (!scrollContainer || entries.length === 0) return;
    const handleScroll = () => {
      const containerTop = scrollContainer.getBoundingClientRect().top;
      let current: string | null = entries[0]?.date ?? null;
      for (const e of entries) {
        const el = scrollContainer.querySelector<HTMLElement>(`#${CSS.escape(entryIdForDate(e.date))}`);
        if (!el) continue;
        const top = el.getBoundingClientRect().top - containerTop;
        if (top <= 40) current = e.date;
        else break;
      }
      setActiveDate(current);
    };
    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [scrollContainer, entries]);

  // Ordered desc (most recent first) in the list
  const ordered = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  if (entries.length === 0) {
    return (
      <div className="p-4 text-[11px] leading-relaxed text-muted-foreground/70">
        Nenhuma data ainda. Use <span className="font-semibold text-foreground">“Nova data”</span> para abrir a primeira seção datada.
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 mb-3">
        Datas desta nota
      </p>
      <ul className="space-y-0.5">
        {ordered.map((e) => {
          const isActive = activeDate === e.date;
          const isToday = e.date === today;
          return (
            <li key={e.date}>
              <button
                type="button"
                onClick={() => onJump(e.date)}
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
                    "text-[12px] tabular-nums",
                    isActive ? "font-semibold text-foreground" : "text-foreground/80",
                  )}
                >
                  {formatEntryShort(e.date)}
                </span>
                {isToday && (
                  <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-primary">
                    hoje
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
