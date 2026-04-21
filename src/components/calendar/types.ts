export interface GoogleCalendar {
  id: string;
  summary: string;
  backgroundColor: string;
  primary?: boolean;
}

export interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  calendarId?: string;
  calendarColor?: string;
}

export interface CalendarTask {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  priority: string;
  space_id: string | null;
  estimated_minutes?: number | null;
  spaces?: { name: string } | null;
  hasReminder?: boolean;
}

export type CalendarView = "month" | "week" | "day";

/** Unified item displayed inside calendar cells/slots */
export type CalendarItem =
  | { kind: "event"; data: GoogleEvent; date: Date; time: string | null }
  | { kind: "task"; data: CalendarTask; date: Date; time: string | null };
