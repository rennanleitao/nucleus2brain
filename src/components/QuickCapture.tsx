import { useState } from "react";
import { Zap } from "lucide-react";
import { Input } from "@/components/ui/input";

export function QuickCapture() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    // TODO: Send to AI for interpretation
    console.log("Quick capture:", value);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 max-w-md mx-4">
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-all ${
        focused ? "border-primary bg-card shadow-elevated" : "border-border bg-secondary/50"
      }`}>
        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Quick capture — type a task, note, or command..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
        {value && (
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
            ↵
          </kbd>
        )}
      </div>
    </form>
  );
}
