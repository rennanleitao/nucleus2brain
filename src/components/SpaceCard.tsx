import { forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { SpaceIcon } from "@/components/SpaceIconPicker";
import { ChevronRight } from "lucide-react";

interface SpaceCardProps {
  space: {
    id: string;
    name: string;
    description?: string | null;
    icon: string | null;
    tasks?: { count: number }[];
    notes?: { count: number }[];
  };
  onClick?: () => void;
  variant?: "card" | "list";
}

export const SpaceCard = forwardRef<HTMLButtonElement, SpaceCardProps>(({ space, onClick, variant = "card" }, ref) => {
  const navigate = useNavigate();
  const taskCount = space.tasks?.[0]?.count ?? 0;
  const noteCount = space.notes?.[0]?.count ?? 0;

  const handleClick = () => {
    if (onClick) onClick();
    else navigate(`/spaces/${space.id}`);
  };

  if (variant === "list") {
    return (
      <button
        ref={ref}
        onClick={handleClick}
        className="flex items-center gap-3 w-full px-4 py- ="text-4xl"
      >
        <SpaceIcon iconKey={space.icon} className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-small font-medium truncate">{space.name}</h3>
        </div>
        <div className="flex items-center gap-3 text-micro text-muted-foreground flex-shrink-0">
          <span>{taskCount} tasks</span>
          <span>{noteCount} notes</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 group-hover:text-muted-foreground transition-colors" />
      </button>
    );
  }

  return (
    <button
      ref={ref}
      onClick={handleClick}
      className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-card hover:shadow-elevated hover:border-primary/20 transition-all text-left animate-fade-in touch-manipulation active:scale-[0.98]"
    >
      <SpaceIcon iconKey={space.icon} className="h-6 w-6 text-muted-foreground" />
      <div>
        <h3 className="text-small font-semibold">{space.name}</h3>
        {space.description && (
          <p className="text-micro text-muted-foreground mt-0.5">{space.description}</p>
        )}
      </div>
      <div className="flex gap-3 text-micro text-muted-foreground">
        <span>{taskCount} tasks</span>
        <span>{noteCount} notes</span>
      </div>
    </button>
  );
});

SpaceCard.displayName = "SpaceCard";
