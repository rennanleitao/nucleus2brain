import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database";

// ---- FILE UPLOAD ----
export async function uploadAttachment(spaceId: string, file: File) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const path = `${user.id}/${spaceId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file);
  if (uploadError) throw uploadError;
  const { data, error } = await supabase.from("attachments").insert({
    user_id: user.id,
    space_id: spaceId,
    file_name: file.name,
    file_path: path,
    file_size: file.size,
    content_type: file.type,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function fetchAttachments(spaceId: string) {
  const { data, error } = await supabase.from("attachments").select("*").eq("space_id", spaceId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteAttachment(id: string, filePath: string) {
  await supabase.storage.from("attachments").remove([filePath]);
  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) throw error;
}

export function getAttachmentUrl(filePath: string) {
  const { data } = supabase.storage.from("attachments").getPublicUrl(filePath);
  return data.publicUrl;
}

// ---- SPACE DETAIL ----
export async function fetchSpace(id: string) {
  const { data, error } = await supabase.from("spaces").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function fetchTasksBySpace(spaceId: string) {
  const { data, error } = await supabase.from("tasks").select("*, spaces(name)").eq("space_id", spaceId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchNotesBySpace(spaceId: string) {
  const { data, error } = await supabase.from("notes").select("*, spaces(name)").eq("space_id", spaceId).order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchLinksBySpace(spaceId: string) {
  const { data, error } = await supabase.from("links").select("*").eq("space_id", spaceId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createLink(link: { title: string; url: string; description?: string | null; space_id?: string | null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase.from("links").insert({ ...link, user_id: user.id }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLink(id: string) {
  const { error } = await supabase.from("links").delete().eq("id", id);
  if (error) throw error;
}

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

// ---- TAGGED SNIPPETS ----
export async function createTaggedSnippet(noteId: string, tag: string, snippetText: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("tagged_snippets")
    .insert({ user_id: user.id, note_id: noteId, tag, snippet_text: snippetText })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTaggedSnippets() {
  const { data, error } = await supabase
    .from("tagged_snippets")
    .select("*, notes(title)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteTaggedSnippet(id: string) {
  const { error } = await supabase.from("tagged_snippets").delete().eq("id", id);
  if (error) throw error;
}
