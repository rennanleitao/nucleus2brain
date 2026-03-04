import { Space } from "@/types";
import { useNavigate } from "react-router-dom";

interface SpaceCardProps {
  space: Space;
}

export function SpaceCard({ space }: SpaceCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/spaces/${space.id}`)}
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
        <span>{space.taskCount} tasks</span>
        <span>{space.noteCount} notes</span>
      </div>
    </button>
  );
}
