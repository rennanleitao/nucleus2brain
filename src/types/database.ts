export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; user_id: string; name: string | null; avatar_url: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; name?: string | null; avatar_url?: string | null };
        Update: { name?: string | null; avatar_url?: string | null };
      };
      spaces: {
        Row: { id: string; user_id: string; name: string; description: string | null; icon: string; created_at: string };
        Insert: { id?: string; user_id?: string; name: string; description?: string | null; icon?: string };
        Update: { name?: string; description?: string | null; icon?: string };
      };
      tasks: {
        Row: {
          id: string; user_id: string; space_id: string | null; title: string; description: string | null;
          status: "todo" | "in_progress" | "waiting" | "completed" | "cancelled";
          priority: "low" | "medium" | "high";
          due_date: string | null; created_at: string; completed_at: string | null;
        };
        Insert: {
          id?: string; user_id?: string; space_id?: string | null; title: string; description?: string | null;
          status?: "todo" | "in_progress" | "waiting" | "completed" | "cancelled";
          priority?: "low" | "medium" | "high"; due_date?: string | null;
        };
        Update: {
          title?: string; description?: string | null; space_id?: string | null;
          status?: "todo" | "in_progress" | "waiting" | "completed" | "cancelled";
          priority?: "low" | "medium" | "high"; due_date?: string | null; completed_at?: string | null;
        };
      };
      notes: {
        Row: { id: string; user_id: string; space_id: string | null; title: string; content: string; tags: string[]; created_at: string; updated_at: string };
        Insert: { id?: string; user_id?: string; space_id?: string | null; title: string; content?: string; tags?: string[] };
        Update: { title?: string; content?: string; tags?: string[]; space_id?: string | null };
      };
      links: {
        Row: { id: string; user_id: string; space_id: string | null; title: string; url: string; description: string | null; created_at: string };
        Insert: { id?: string; user_id?: string; space_id?: string | null; title: string; url: string; description?: string | null };
        Update: { title?: string; url?: string; description?: string | null };
      };
      reminders: {
        Row: { id: string; user_id: string; task_id: string | null; reminder_time: string; sent: boolean; created_at: string };
        Insert: { id?: string; user_id?: string; task_id?: string | null; reminder_time: string; sent?: boolean };
        Update: { reminder_time?: string; sent?: boolean };
      };
      ai_settings: {
        Row: { id: string; user_id: string; provider: string; model: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_id?: string; provider?: string; model?: string };
        Update: { provider?: string; model?: string };
      };
    };
  };
}
