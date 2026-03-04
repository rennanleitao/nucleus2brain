import { Space, Task, Note, CalendarEvent } from "@/types";

export const mockSpaces: Space[] = [
  { id: "1", name: "Clients", description: "Client projects and tasks", icon: "👥", taskCount: 8, noteCount: 3 },
  { id: "2", name: "Projects", description: "Active projects", icon: "🚀", taskCount: 12, noteCount: 7 },
  { id: "3", name: "Ideas", description: "Brainstorming and ideas", icon: "💡", taskCount: 4, noteCount: 11 },
  { id: "4", name: "Personal", description: "Personal tasks and notes", icon: "🏠", taskCount: 5, noteCount: 2 },
  { id: "5", name: "Learning", description: "Courses, articles, resources", icon: "📚", taskCount: 3, noteCount: 9 },
];

const today = new Date().toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

export const mockTasks: Task[] = [
  { id: "t1", spaceId: "1", spaceName: "Clients", title: "Finish Profectum proposal", status: "in_progress", priority: "high", dueDate: today, createdAt: yesterday },
  { id: "t2", spaceId: "1", spaceName: "Clients", title: "Prepare V.Tal meeting deck", status: "todo", priority: "high", dueDate: today, createdAt: yesterday },
  { id: "t3", spaceId: "2", spaceName: "Projects", title: "Review automation pipeline", status: "todo", priority: "medium", dueDate: today, createdAt: yesterday },
  { id: "t4", spaceId: "1", spaceName: "Clients", title: "Follow up with Rafael", status: "waiting", priority: "medium", dueDate: yesterday, createdAt: yesterday },
  { id: "t5", spaceId: "2", spaceName: "Projects", title: "Deploy staging environment", status: "todo", priority: "low", dueDate: tomorrow, createdAt: today },
  { id: "t6", spaceId: "4", spaceName: "Personal", title: "Book dentist appointment", status: "todo", priority: "low", dueDate: tomorrow, createdAt: today },
  { id: "t7", spaceId: "3", spaceName: "Ideas", title: "Write product roadmap draft", status: "in_progress", priority: "high", dueDate: yesterday, createdAt: yesterday },
  { id: "t8", spaceId: "5", spaceName: "Learning", title: "Complete TypeScript module", status: "todo", priority: "medium", dueDate: tomorrow, createdAt: today },
];

export const mockNotes: Note[] = [
  { id: "n1", spaceId: "2", spaceName: "Projects", title: "Architecture Decision Records", content: "Key decisions for the new platform...", tags: ["architecture", "decisions"], createdAt: yesterday, updatedAt: today },
  { id: "n2", spaceId: "3", spaceName: "Ideas", title: "Product Feature Brainstorm", content: "Ideas for Q2 feature development...", tags: ["product", "brainstorm"], createdAt: yesterday, updatedAt: yesterday },
  { id: "n3", spaceId: "5", spaceName: "Learning", title: "React Server Components Notes", content: "Key takeaways from RSC deep dive...", tags: ["react", "learning"], createdAt: today, updatedAt: today },
];

export const mockEvents: CalendarEvent[] = [
  { id: "e1", title: "Automation Discussion", startTime: `${today}T10:00:00`, endTime: `${today}T11:00:00` },
  { id: "e2", title: "Client Call - V.Tal", startTime: `${today}T15:00:00`, endTime: `${today}T16:00:00` },
  { id: "e3", title: "Team Standup", startTime: `${tomorrow}T09:00:00`, endTime: `${tomorrow}T09:30:00` },
];
