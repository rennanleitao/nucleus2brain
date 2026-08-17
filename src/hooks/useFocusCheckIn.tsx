import { useCallback, useEffect, useState } from "react";

const SETTINGS_KEY = "focus_checkin_settings_v1";
const LAST_KEY = "focus_checkin_last_at_v1";
const LOG_KEY = "focus_checkin_log_v1";
const EVENT_NAME = "focus-checkin-settings-changed";

export interface FocusCheckInSettings {
  enabled: boolean;
  intervalMinutes: number;
  startHour: number;
  endHour: number;
  notify: boolean;
}

export const DEFAULT_FOCUS_SETTINGS: FocusCheckInSettings = {
  enabled: false,
  intervalMinutes: 60,
  startHour: 8,
  endHour: 19,
  notify: true,
};

export interface FocusCheckInEntry {
  at: string;
  activity: string;
  aligned: boolean;
  taskId?: string | null;
}

export function readFocusSettings(): FocusCheckInSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_FOCUS_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_FOCUS_SETTINGS;
}

export function readFocusLog(): FocusCheckInEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) return JSON.parse(raw) as FocusCheckInEntry[];
  } catch {
    // ignore
  }
  return [];
}

export function appendFocusLog(entry: FocusCheckInEntry) {
  const next = [entry, ...readFocusLog()].slice(0, 100);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

const SNOOZE_KEY = "focus_checkin_snooze_until_v1";

function markChecked() {
  try {
    localStorage.setItem(LAST_KEY, String(Date.now()));
    localStorage.removeItem(SNOOZE_KEY);
  } catch {
    // ignore
  }
}


function snoozedUntil(): number {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (raw) return Number(raw) || 0;
  } catch {
    // ignore
  }
  return 0;
}

function lastCheckedAt(): number {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (raw) return Number(raw) || 0;
  } catch {
    // ignore
  }
  return 0;
}

/** Settings state + updater, shared across components via a window event. */
export function useFocusCheckInSettings() {
  const [settings, setSettings] = useState<FocusCheckInSettings>(() => readFocusSettings());

  useEffect(() => {
    const onChange = () => setSettings(readFocusSettings());
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = useCallback((patch: Partial<FocusCheckInSettings>) => {
    const next = { ...readFocusSettings(), ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(EVENT_NAME));
    setSettings(next);
  }, []);

  return { settings, update };
}

/** Drives the periodic check-in prompt. */
export function useFocusCheckIn() {
  const { settings } = useFocusCheckInSettings();
  const [due, setDue] = useState(false);

  useEffect(() => {
    if (!settings.enabled) {
      setDue(false);
      return;
    }

    const tick = () => {
      // Re-read from storage so a toggle in another tab/view takes effect immediately.
      const current = readFocusSettings();
      if (!current.enabled) {
        setDue(false);
        return;
      }

      const now = new Date();
      const hour = Number(
        new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          hour12: false,
        }).format(now),
      );
      if (hour < current.startHour || hour >= current.endHour) return;
      if (document.hidden) return;

      const snooze = snoozedUntil();
      if (snooze > 0) {
        // While snoozed, nothing fires; once it expires, fire immediately.
        if (Date.now() < snooze) return;
      } else {
        const elapsed = Date.now() - lastCheckedAt();
        if (elapsed < current.intervalMinutes * 60_000) return;
      }

      setDue(true);
      if (current.notify && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("Nucleus", {
            body: "O que você está fazendo agora? Isso está no plano do dia?",
            icon: "/pwa-192x192.png",
          });
        } catch {
          // ignore
        }
      }
    };

    const id = setInterval(tick, 30_000);
    const initial = setTimeout(tick, 5_000);
    return () => {
      clearInterval(id);
      clearTimeout(initial);
    };
  }, [settings.enabled, settings.intervalMinutes, settings.startHour, settings.endHour, settings.notify]);

  const dismiss = useCallback(() => {
    // A pending snooze wins: closing the dialog must not shorten the snooze.
    if (Date.now() < snoozedUntil()) {
      setDue(false);
      return;
    }
    markChecked();
    setDue(false);
  }, []);

  const snooze = useCallback((minutes: number) => {
    try {
      const target = Date.now() + minutes * 60_000;
      // Baseline the interval from now, and hard-block until the snooze target.
      localStorage.setItem(LAST_KEY, String(Date.now()));
      localStorage.setItem(SNOOZE_KEY, String(target));
    } catch {
      // ignore
    }
    setDue(false);
  }, []);

  return { due, dismiss, snooze, settings };
}
