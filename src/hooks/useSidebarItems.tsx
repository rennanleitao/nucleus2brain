/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, useCallback } from "react";

export const SIDEBAR_ITEMS = [
  { key: "assistant", title: "Personal Assistant", url: "/" },
  { key: "dashboard", title: "Dashboard", url: "/dashboard" },
  { key: "spaces", title: "Spaces", url: "/spaces" },
  { key: "notes", title: "Notes", url: "/notes" },
  { key: "tasks", title: "Tasks", url: "/tasks" },
  { key: "studies", title: "Conhecimento", url: "/estudos" },
  { key: "meeting-copilot", title: "Meeting Copilot", url: "/meeting-copilot" },
  { key: "materials", title: "Materials", url: "/materials" },
  { key: "tags", title: "Tags", url: "/tags" },
  { key: "calendar", title: "Calendar", url: "/calendar" },
  { key: "pomodoro", title: "Pomodoro", url: "/pomodoro" },
] as const;

export type SidebarItemKey = (typeof SIDEBAR_ITEMS)[number]["key"];

const STORAGE_KEY = "sidebar_visible_items_v1";
const EVENT_NAME = "sidebar-visible-items-changed";

const ALL_KEYS = SIDEBAR_ITEMS.map((i) => i.key) as SidebarItemKey[];
// Keys added after the storage key was first introduced — auto-enable so users
// who already have a stored visibility list still see new modules.
const AUTO_ENABLE_NEW_KEYS: SidebarItemKey[] = ["studies", "meeting-copilot"];

function readStored(): SidebarItemKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ALL_KEYS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ALL_KEYS;
    const filtered = parsed.filter((k): k is SidebarItemKey =>
      ALL_KEYS.includes(k as SidebarItemKey)
    );
    if (filtered.length === 0) return ALL_KEYS;
    // Inject any newly-introduced keys the user hasn't seen yet.
    let mutated = false;
    for (const key of AUTO_ENABLE_NEW_KEYS) {
      if (!filtered.includes(key)) {
        filtered.push(key);
        mutated = true;
      }
    }
    if (mutated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      } catch {
        // Ignore storage failures and keep the in-memory navigation list.
      }
    }
    return filtered;
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
