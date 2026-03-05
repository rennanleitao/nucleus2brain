import { forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { SpaceIcon } from "@/components/SpaceIconPicker";

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
}

export const SpaceCard = forwardRef<HTMLButtonElement, SpaceCardProps>(({ space, onClick }, ref) => {
  const navigate = useNavigate();
  const taskCount = space.tasks?.[0]?.count ?? 0;
  const noteCount = space.notes?.[0]?.count ?? 0;

  const handleClick = () => {
    if (onClick) onClick();
    else navigate(`/spaces/${space.id}`);
  };

  return (
    <button
      ref={ref}
      onClick={handleClick}
      className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-card hover:shadow-elevated hover:border-primary/20 transition-all text-left animate-fade-in"
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
