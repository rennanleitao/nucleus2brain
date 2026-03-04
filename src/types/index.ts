export type TaskStatus = "todo" | "in_progress" | "waiting" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type AIProvider = "openai" | "claude" | "lovable" | "mistral";

export interface Space {
  id: string;
  name: string;
  description?: string;
  icon: string;
  taskCount: number;
  noteCount: number;
}

export interface Task {
  id: string;
  spaceId?: string;
  spaceName?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Note {
  id: string;
  spaceId?: string;
  spaceName?: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  linkedTaskId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  action?: AIAction;
}

export interface AIAction {
  type: "create_task" | "create_reminder" | "create_event" | "suggest_priorities";
  payload: Record<string, unknown>;
}
