import { useEffect, useMemo, useState } from "react";
import { Sparkles, X, Paperclip, Image as ImageIcon, ExternalLink, FileText, Link as LinkIcon } from "lucide-react";
import {
  parseNoteEntries,
  parseNoteTopics,
  parseNoteAttachments,
  formatEntryShort,
  entryIdForDate,
} from "@/lib/noteEntries";
import { getBrtToday } from "@/lib/timezone";
import { cn } from "@/lib/utils";

interface NoteDateSidebarProps {
  html: string;
  scrollContainer?: HTMLElement | null;
  onJump: (date: string) => void;
  onRemoveTopic?: (topicId: string) => void;
}

export function NoteDateSidebar({ html, scrollContainer, onJump, onRemoveTopic }: NoteDateSidebarProps) {
  const entries = useMemo(() => parseNoteEntries(html), [html]);
  const topics = useMemo(() => parseNoteTopics(html), [html]);
  const attachments = useMemo(() => parseNoteAttachments(html), [html]);
  const today = getBrtToday();
  const [activeDate, setActiveDate] = useState<string | null>(null);

  // Scroll-spy for date entries.
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

  const ordered = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  const jumpToTopic = (id: string) => {
    if (!scrollContainer) return;
    const el = scrollContainer.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Brief flash so the user spots the highlighted snippet.
    el.animate?.(
      [{ filter: "brightness(1.6)" }, { filter: "brightness(1)" }],
      { duration: 900, easing: "ease-out" },
    );
  };

  const isEmpty = entries.length === 0 && topics.length === 0;
  if (isEmpty) {
    return (
      <div className="p-4 text-[11px] leading-relaxed text-muted-foreground/70">
        Nenhuma data ou tópico ainda. Use <span className="font-semibold text-foreground">“Nova data”</span> para
        abrir uma seção datada, ou selecione um trecho e clique em <span className="font-semibold text-foreground">Tópico</span>.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {entries.length > 0 && (
        <div>
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
      )}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 mb-3 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Tópicos importantes
        </p>
        {topics.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground/60">
            Selecione um trecho no editor e clique em <span className="font-medium text-foreground">Tópico</span> para
            marcá-lo como importante.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {topics.map((t) => (
              <li key={t.id} className="group relative">
                <button
                  type="button"
                  onClick={() => jumpToTopic(t.id)}
                  title={t.text}
                  className="w-full flex items-start gap-2 px-2 py-1.5 pr-7 rounded-md text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="mt-1 block w-1 h-1 rounded-full bg-primary/70 flex-shrink-0" />
                  <span className="text-[11.5px] leading-snug text-foreground/85 line-clamp-2">
                    {t.text}
                  </span>
                </button>
                {onRemoveTopic && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTopic(t.id);
                    }}
                    title="Remover tópico"
                    className="absolute top-1.5 right-1 opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
