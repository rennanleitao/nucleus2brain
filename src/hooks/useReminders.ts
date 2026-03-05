import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useReminders() {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    const checkReminders = async () => {
      const now = new Date().toISOString();
      const { data: reminders } = await supabase
        .from("reminders")
        .select("*, tasks(title)")
        .eq("user_id", user.id)
        .eq("sent", false)
        .lte("reminder_time", now);

      if (reminders && reminders.length > 0) {
        for (const reminder of reminders) {
          const taskTitle = (reminder as any).tasks?.title || "Task";
          
          // Show browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("⏰ Lembrete", {
              body: taskTitle,
              icon: "/pwa-192x192.png",
            });
          }

          // Show toast
          toast.info(`⏰ Lembrete: ${taskTitle}`, { duration: 10000 });

          // Mark as sent
          await supabase.from("reminders").update({ sent: true }).eq("id", reminder.id);
        }
      }
    };

    // Check immediately and then every 30 seconds
    checkReminders();
    intervalRef.current = setInterval(checkReminders, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);
}
