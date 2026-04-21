import { useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { createTask } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getBrtToday, getBrtTomorrow, addDaysBrt } from "@/lib/timezone";

export function QuickCapture() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || loading) return;

    const input = value.trim();
    setValue("");
    setLoading(true);

    try {
      // Parse natural language into task
      const parsed = parseQuickInput(input);
      await createTask({
        title: parsed.title,
        priority: parsed.priority,
        due_date: parsed.dueDate || null,
      });
      toast.success(`Task created: ${parsed.title}`, {
        action: {
          label: "View",
          onClick: () => navigate("/tasks"),
        },
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 max-w-md mx-2 sm:mx-4">
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 sm:py-1.5 transition-all ${
        focused ? "border-primary bg-card shadow-elevated" : "border-border bg-secondary/50"
      }`}>
        {loading ? (
          <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
        ) : (
          <Zap className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <input
          type="text"
          placeholder={focused ? "Type a task and press Enter..." : "Quick capture..."}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 min-w-0"
          disabled={loading}
        />
        {value && (
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono flex-shrink-0">
            ↵
          </kbd>
        )}
      </div>
    </form>
  );
}

function parseQuickInput(input: string): { title: string; priority: "low" | "medium" | "high"; dueDate?: string } {
  let title = input;
  let priority: "low" | "medium" | "high" = "medium";
  let dueDate: string | undefined;

  // Detect priority keywords
  if (/\b(urgent|urgente|importante|critical|alta)\b/i.test(input)) {
    priority = "high";
    title = title.replace(/\b(urgent|urgente|importante|critical|alta)\b/gi, "").trim();
  }

  // Detect date keywords (BRT)
  if (/\b(today|hoje)\b/i.test(input)) {
    dueDate = getBrtToday();
    title = title.replace(/\b(today|hoje)\b/gi, "").trim();
  } else if (/\b(tomorrow|amanhã|amanha)\b/i.test(input)) {
    dueDate = getBrtTomorrow();
    title = title.replace(/\b(tomorrow|amanhã|amanha)\b/gi, "").trim();
  } else if (/\b(next week|semana que vem|próxima semana|proxima semana)\b/i.test(input)) {
    dueDate = addDaysBrt(getBrtToday(), 7);
    title = title.replace(/\b(next week|semana que vem|próxima semana|proxima semana)\b/gi, "").trim();
  }

  // Clean up extra spaces
  title = title.replace(/\s+/g, " ").replace(/^[,.\s]+|[,.\s]+$/g, "").trim();

  return { title, priority, dueDate };
}
