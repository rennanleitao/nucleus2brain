import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "default_landing_route_v1";
const EVENT_NAME = "default-landing-route-changed";
export const DEFAULT_LANDING_FALLBACK = "/tasks";

export const LANDING_OPTIONS = [
  { value: "/tasks", label: "Tasks" },
  { value: "/assistant", label: "Helena" },
  { value: "/dashboard", label: "Dashboard" },
  { value: "/spaces", label: "Spaces" },
  { value: "/notes", label: "Notes" },
  { value: "/emails", label: "E-mails" },
  { value: "/estudos", label: "Conhecimento" },
  { value: "/reunioes", label: "Meeting Copilot" },
  { value: "/materials", label: "Materials" },
  { value: "/tags", label: "Tags" },
  { value: "/calendar", label: "Calendar" },
  { value: "/pomodoro", label: "Pomodoro" },
] as const;

const VALID = new Set<string>(LANDING_OPTIONS.map((o) => o.value));

function read(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && VALID.has(raw)) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_LANDING_FALLBACK;
}

export function useDefaultLanding() {
  const [route, setRoute] = useState<string>(() => read());

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setDefault = useCallback((next: string) => {
    if (!VALID.has(next)) return;
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(EVENT_NAME));
    setRoute(next);
  }, []);

  return { route, setDefault, options: LANDING_OPTIONS };
}
