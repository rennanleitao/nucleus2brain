import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];
type SpaceInsert = Database["public"]["Tables"]["spaces"]["Insert"];
type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
type NoteInsert = Database["public"]["Tables"]["notes"]["Insert"];
type NoteUpdate = Database["public"]["Tables"]["notes"]["Update"];

// ---- TASKS ----
export async function fetchTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, spaces(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTask(task: Omit<TaskInsert, "user_id">) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...task, user_id: user.id })
    .select("*, spaces(name)")
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, updates: TaskUpdate) {
  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select("*, spaces(name)")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---- SPACES ----
export async function fetchSpaces() {
  const { data, error } = await supabase
    .from("spaces")
    .select("*, tasks(count), notes(count)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createSpace(space: Omit<SpaceInsert, "user_id">) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("spaces")
    .insert({ ...space, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSpace(id: string) {
  const { error } = await supabase.from("spaces").delete().eq("id", id);
  if (error) throw error;
}

// ---- NOTES ----
export async function fetchNotes() {
  const { data, error } = await supabase
    .from("notes")
    .select("*, spaces(name)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createNote(note: Omit<NoteInsert, "user_id">) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("notes")
    .insert({ ...note, user_id: user.id })
    .select("*, spaces(name)")
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(id: string, updates: NoteUpdate) {
  const { data, error } = await supabase
    .from("notes")
    .update(updates)
    .eq("id", id)
    .select("*, spaces(name)")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}
