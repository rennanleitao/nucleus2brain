import { Badge } from "@/components/ui/badge";
import { TOPIC_STATUS_LABELS, type StudyTopicStatus } from "@/hooks/useStudies";
import { cn } from "@/lib/utils";

const STYLES: Record<StudyTopicStatus, string> = {
  monitorar: "bg-muted text-muted-foreground border-border",
  em_mudanca: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  estavel: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  pressionado: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900",
  critico: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
  arquivado: "bg-muted text-muted-foreground/60 border-border",
};

export function StatusBadge({ status, className }: { status: StudyTopicStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal text-[10px] uppercase tracking-wider", STYLES[status], className)}>
      {TOPIC_STATUS_LABELS[status]}
    </Badge>
  );
}
