import { forwardRef } from "react";

interface SpaceCardProps {
  space: {
    id: string;
    name: string;
    description?: string | null;
    icon: string;
    tasks?: { count: number }[];
    notes?: { count: number }[];
  };
  onClick?: () => void;
}

export const SpaceCard = forwardRef<HTMLButtonElement, SpaceCardProps>(({ space, onClick }, ref) => {
  const taskCount = space.tasks?.[0]?.count ?? 0;
  const noteCount = space.notes?.[0]?.count ?? 0;

  return (
    <button
      ref={ref}
      onClick={onClick}
      className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-card hover:shadow-elevated hover:border-primary/20 transition-all text-left animate-fade-in"
    >
      <div className="text-2xl">{space.icon}</div>
      <div>
        <h3 className="text-sm font-semibold">{space.name}</h3>
        {space.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{space.description}</p>
        )}
      </div>
      <div className="flex gap-3 text-[11px] text-muted-foreground">
        <span>{taskCount} tasks</span>
        <span>{noteCount} notes</span>
      </div>
    </button>
  );
});

SpaceCard.displayName = "SpaceCard";
