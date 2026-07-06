import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getBrtToday } from "@/lib/timezone";

interface NoteDatePickerProps {
  onPick: (date: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NoteDatePicker({ onPick, disabled, compact }: NoteDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(() => {
    const today = getBrtToday();
    const [y, m, d] = today.split("-").map(Number);
    return new Date(y, m - 1, d);
  });

  const handleConfirm = () => {
    if (!date) return;
    onPick(toISO(date));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size={compact ? "sm" : "default"}
          variant="outline"
          disabled={disabled}
          className={cn("h-8 gap-1.5 text-[11px] font-medium", compact && "px-2")}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          Nova data
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="flex justify-end gap-2 p-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!date}>
            Inserir
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
