import { useEffect, useState, useCallback } from "react";

export const SIDEBAR_ITEMS = [
  { key: "assistant", title: "Personal Assistant", url: "/" },
  { key: "dashboard", title: "Dashboard", url: "/dashboard" },
  { key: "spaces", title: "Spaces", url: "/spaces" },
  { key: "notes", title: "Notes", url: "/notes" },
  { key: "tasks", title: "Tasks", url: "/tasks" },
  { key: "materials", title: "Materials", url: "/materials" },
  { key: "tags", title: "Tags", url: "/tags" },
  { key: "calendar", title: "Calendar", url: "/calendar" },
  { key: "pomodoro", title: "Pomodoro", url: "/pomodoro" },
] as const;

export type SidebarItemKey = (typeof SIDEBAR_ITEMS)[number]["key"];

const STORAGE_KEY = "sidebar_visible_items_v1";
const EVENT_NAME = "sidebar-visible-items-changed";

const ALL_KEYS = SIDEBAR_ITEMS.map((i) => i.key) as SidebarItemKey[];

function readStored(): SidebarItemKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ALL_KEYS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ALL_KEYS;
    const filtered = parsed.filter((k): k is SidebarItemKey =>
      ALL_KEYS.includes(k as SidebarItemKey)
    );
    return filtered.length > 0 ? filtered : ALL_KEYS;
  } catch {
    return ALL_KEYS;
  }
}

export function useSidebarItems() {
  const [visible, setVisible] = useState<SidebarItemKey[]>(() => readStored());

  useEffect(() => {
    const onChange = () => setVisible(readStored());
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const toggle = useCallback((key: SidebarItemKey) => {
    setVisible((prev) => {
      // Always keep at least one item (Personal Assistant fallback)
      const has = prev.includes(key);
      let next = has ? prev.filter((k) => k !== key) : [...prev, key];
      if (next.length === 0) next = ["assistant"];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT_NAME));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ALL_KEYS));
    window.dispatchEvent(new Event(EVENT_NAME));
    setVisible(ALL_KEYS);
  }, []);

  return { visible, toggle, reset, all: SIDEBAR_ITEMS };
}
