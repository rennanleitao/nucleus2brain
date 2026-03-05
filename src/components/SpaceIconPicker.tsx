import { FolderOpen, Users, Lightbulb, BookOpen, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export const SPACE_ICONS = [
  { key: "folder", Icon: FolderOpen },
  { key: "users", Icon: Users },
  { key: "lightbulb", Icon: Lightbulb },
  { key: "book", Icon: BookOpen },
  { key: "target", Icon: Target },
] as const;

export type SpaceIconKey = typeof SPACE_ICONS[number]["key"];

export function getSpaceIcon(key: string | null | undefined) {
  return SPACE_ICONS.find(i => i.key === key) ?? SPACE_ICONS[0];
}

export function SpaceIcon({ iconKey, className }: { iconKey: string | null | undefined; className?: string }) {
  const { Icon } = getSpaceIcon(iconKey);
  return <Icon className={cn("h-5 w-5", className)} />;
}

interface SpaceIconPickerProps {
  value: string;
  onChange: (key: string) => void;
}

export function SpaceIconPicker({ value, onChange }: SpaceIconPickerProps) {
  return (
    <div className="flex gap-1.5">
      {SPACE_ICONS.map(({ key, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "p-2 rounded-lg transition-colors",
            value === key ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
          )}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}
