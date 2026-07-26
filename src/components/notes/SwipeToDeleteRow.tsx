import { ReactNode, useRef, useState } from "react";
import { X } from "lucide-react";

interface Props {
  children: ReactNode;
  onDelete: () => void | Promise<void>;
  ariaLabel?: string;
  /** Threshold in px to trigger delete on release. */
  threshold?: number;
}

/**
 * Row wrapper that supports swipe-left-to-delete on touch devices
 * and shows a discreet × on desktop hover. Replaces obtrusive trash icons.
 */
export function SwipeToDeleteRow({ children, onDelete, ariaLabel = "Excluir", threshold = 72 }: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const locked = useRef<"h" | "v" | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    locked.current = null;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null || startY.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (!locked.current) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        locked.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }
    }
    if (locked.current === "h") {
      // only allow left swipe (negative)
      const next = Math.min(0, Math.max(dx, -140));
      setOffset(next);
    }
  };
  const onTouchEnd = async () => {
    setDragging(false);
    if (locked.current === "h" && offset <= -threshold) {
      // animate out then fire
      setOffset(-400);
      setTimeout(() => { void onDelete(); }, 120);
    } else {
      setOffset(0);
    }
    startX.current = null;
    startY.current = null;
    locked.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-md">
      {/* Reveal panel behind */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-3 pointer-events-none bg-destructive/10 text-destructive text-[11px] font-medium uppercase tracking-wider"
        style={{ width: Math.min(140, Math.abs(offset)), opacity: Math.min(1, Math.abs(offset) / threshold) }}
      >
        Excluir
      </div>

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 180ms cubic-bezier(.2,.8,.2,1)",
        }}
        className="relative bg-transparent group/swipe"
      >
        {children}
        <button
          type="button"
          aria-label={ariaLabel}
          title={ariaLabel}
          onClick={(e) => { e.stopPropagation(); void onDelete(); }}
          className="hidden md:inline-flex absolute top-1/2 -translate-y-1/2 right-1.5 h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/swipe:opacity-100 focus:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
