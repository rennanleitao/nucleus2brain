/**
 * Brasília Time (BRT) timezone helpers.
 *
 * The app's canonical timezone is America/Sao_Paulo. All date/time
 * computations involving "today", "tomorrow", scheduling, or display
 * MUST go through these helpers — never use raw `new Date().toISOString()`
 * which is in UTC and produces wrong results around midnight in Brazil.
 */

export const BRT_TZ = "America/Sao_Paulo";

/** Returns the current date as a Date object adjusted to BRT wall-clock. */
export function nowInBrt(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: BRT_TZ }));
}

/** Returns YYYY-MM-DD for today in BRT. */
export function getBrtToday(): string {
  return formatBrtDate(new Date());
}

/** Returns YYYY-MM-DD for tomorrow in BRT. */
export function getBrtTomorrow(): string {
  const t = nowInBrt();
  t.setDate(t.getDate() + 1);
  return toIsoDate(t);
}

/** Returns YYYY-MM-DD for a given Date interpreted in BRT. */
export function formatBrtDate(d: Date): string {
  const brt = new Date(d.toLocaleString("en-US", { timeZone: BRT_TZ }));
  return toIsoDate(brt);
}

/** Returns HH:MM for a given Date interpreted in BRT. */
export function formatBrtTime(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Adds N days to a YYYY-MM-DD string (BRT-safe). */
export function addDaysBrt(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toIsoDate(dt);
}

function toIsoDate(d: Date): string {
  // Use local components to avoid UTC drift.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
