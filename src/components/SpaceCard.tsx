import { forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { SpaceIcon } from "@/components/SpaceIconPicker";
import { SpaceCategoryQuickEdit } from "@/components/SpaceCategoryQuickEdit";
import { ChevronRight } from "lucide-react";

interface SpaceCardProps {
  space: {
    id: string;
    name: string;
    description?: string | null;
    icon: string | null;
    tasks?: { count: number }[];
    notes?: { count: number }[];
    space_categories?: { id: string; name: string } | null;
  };
  onClick?: () => void;
  variant?: "card" | "list";
  hideCategory?: boolean;
  onCategoryChanged?: () => void;
}

export const SpaceCard = forwardRef<HTMLButtonElement, SpaceCardProps>(({ space, onClick, variant = "card", hideCategory, onCategoryChanged }, ref) => {
  const navigate = useNavigate();
  const taskCount = space.tasks?.[0]?.count ?? 0;
  const noteCount = space.notes?.[0]?.count ?? 0;
  const category = space.space_categories;

  const handleClick = () => {
    if (onClick) onClick();
    else navigate(`/spaces/${space.id}`);
  };

  if (variant === "list") {
    return (
      <div
        className="flex items-center gap-3 w-full px-4 py-3.5 bg-transparent border-b border-border/60 hover:bg-muted/40 transition-colors text-left animate-fade-in touch-manipulation group cursor-pointer"
        onClick={handleClick}
      >
        <SpaceIcon iconKey={space.icon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <h3 className="text-[14px] font-semibold leading-tight tracking-[-0.005em] truncate text-foreground">{space.name}</h3>
          {!hideCategory && (
            <SpaceCategoryQuickEdit spaceId={space.id} category={category} onChanged={onCategoryChanged} />
          )}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground tabular-nums flex-shrink-0">
          <span>{taskCount} tasks</span>
          <span>{noteCount} notes</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0 group-hover:text-muted-foreground transition-colors" />
      </div>
    );
  }



  return (
    <button
      ref={ref}
      onClick={handleClick}
      className="flex flex-col gap-3 p-5 rounded-xl border border-border/60 bg-card hover:border-border transition-colors text-left animate-fade-in touch-manipulation active:scale-[0.99]"
    >
      <SpaceIcon iconKey={space.icon} className="h-5 w-5 text-muted-foreground" />
      <div>
        <h3 className="text-[16px] font-semibold leading-tight tracking-[-0.01em] text-foreground">{space.name}</h3>
        {space.description && (
          <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{space.description}</p>
        )}
      </div>
      <div className="flex gap-3 text-[11px] text-muted-foreground tabular-nums pt-1 border-t border-border/40">
        <span>{taskCount} tasks</span>
        <span>·</span>
        <span>{noteCount} notes</span>
      </div>
    </button>
  );
});

SpaceCard.displayName = "SpaceCard";
