import { supabase } from "@/integrations/supabase/client";
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
  const { data, error } = await supabase.from("tasks").select("*, spaces(name), notes(title)").eq("space_id", spaceId).is("deleted_at", null).order("created_at", { ascending: false });
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
  // Background purge of items soft-deleted for >24h (best-effort, non-blocking)
  purgeExpiredDeletedTasks().catch(() => {});
  const { data, error } = await supabase
    .from("tasks")
    .select("*, spaces(name), notes(title)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function duplicateTask(taskId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: original, error: fetchErr } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (fetchErr || !original) throw fetchErr || new Error("Task not found");
  const { id, created_at, completed_at, completion_note, day_order, ...fields } = original;
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...fields, user_id: user.id, status: "todo" as any, completed_at: null, completion_note: null, day_order: null })
    .select("*, spaces(name)")
    .single();
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

// Soft delete — marks deleted_at; row is purged after 24h.
export async function deleteTask(id: string) {
  const { error } = await (supabase as any)
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Restore a soft-deleted task within the 24h window.
export async function restoreTask(id: string) {
  const { error } = await (supabase as any)
    .from("tasks")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw error;
}

// Permanently remove tasks soft-deleted more than 24h ago (client-side cleanup).
export async function purgeExpiredDeletedTasks() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error } = await (supabase as any)
    .from("tasks")
    .delete()
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff);
  if (error) throw error;
}

// ---- SUBTASKS ----
export async function fetchSubtasks(taskId: string) {
  const { data, error } = await supabase
    .from("subtasks")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchAllSubtasks() {
  const { data, error } = await supabase
    .from("subtasks")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createSubtask(subtask: { task_id: string; title: string; due_date?: string | null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("subtasks")
    .insert({ ...subtask, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSubtask(id: string, updates: { title?: string; status?: string; due_date?: string | null; completed_at?: string | null }) {
  const { data, error } = await supabase
    .from("subtasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSubtask(id: string) {
  const { error } = await supabase.from("subtasks").delete().eq("id", id);
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

export async function updateSpace(id: string, updates: Partial<Omit<SpaceInsert, "user_id">>) {
  const { data, error } = await supabase.from("spaces").update(updates).eq("id", id).select().single();
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

// ---- ALL TAGS (from notes + snippets + tasks) ----
export async function fetchAllTags(): Promise<string[]> {
  const [notes, snippets, tasks] = await Promise.all([
    supabase.from("notes").select("tags"),
    supabase.from("tagged_snippets").select("tag"),
    supabase.from("tasks").select("tag"),
  ]);
  const tagSet = new Set<string>();
  (notes.data || []).forEach((n: any) => (n.tags || []).forEach((t: string) => tagSet.add(t)));
  (snippets.data || []).forEach((s: any) => s.tag && tagSet.add(s.tag));
  (tasks.data || []).forEach((t: any) => t.tag && tagSet.add(t.tag));
  return [...tagSet].sort();
}

// ---- REMINDERS ----
export async function fetchReminders() {
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("sent", false)
    .order("reminder_time", { ascending: true });
  if (error) throw error;
  return data;
}

// ---- TAG MANAGEMENT ----
export async function renameTag(oldTag: string, newTag: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // 1. Update notes: replace oldTag with newTag in tags array
  const { data: notesWithTag } = await supabase
    .from("notes")
    .select("id, tags")
    .contains("tags", [oldTag]);

  if (notesWithTag?.length) {
    for (const note of notesWithTag) {
      const updatedTags = (note.tags || []).map((t: string) => t === oldTag ? newTag : t);
      const uniqueTags = [...new Set(updatedTags)];
      await supabase.from("notes").update({ tags: uniqueTags }).eq("id", note.id);
    }
  }

  // 2. Update tagged_snippets
  await supabase
    .from("tagged_snippets")
    .update({ tag: newTag })
    .eq("tag", oldTag)
    .eq("user_id", user.id);

  // 3. Update tasks
  await supabase
    .from("tasks")
    .update({ tag: newTag })
    .eq("tag", oldTag)
    .eq("user_id", user.id);
}

export async function deleteTag(tag: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // 1. Remove tag from notes arrays
  const { data: notesWithTag } = await supabase
    .from("notes")
    .select("id, tags")
    .contains("tags", [tag]);

  if (notesWithTag?.length) {
    for (const note of notesWithTag) {
      const updatedTags = (note.tags || []).filter((t: string) => t !== tag);
      await supabase.from("notes").update({ tags: updatedTags }).eq("id", note.id);
    }
  }

  // 2. Delete tagged_snippets with this tag
  await supabase
    .from("tagged_snippets")
    .delete()
    .eq("tag", tag)
    .eq("user_id", user.id);

  // 3. Clear tag from tasks
  await supabase
    .from("tasks")
    .update({ tag: null })
    .eq("tag", tag)
    .eq("user_id", user.id);
}

// ---- TIME TRACKING ----
export async function fetchTimeEntries(taskId?: string) {
  let query = supabase.from("task_time_entries").select("*").order("started_at", { ascending: false });
  if (taskId) query = query.eq("task_id", taskId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchAllTimeEntries() {
  const { data, error } = await supabase
    .from("task_time_entries")
    .select("*, tasks(title, space_id, spaces(name))")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function startTimeEntry(taskId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  // Stop any running entry for this task first
  const { data: running } = await supabase
    .from("task_time_entries")
    .select("*")
    .eq("task_id", taskId)
    .eq("user_id", user.id)
    .is("ended_at", null);
  if (running && running.length > 0) return running[0];
  const { data, error } = await supabase
    .from("task_time_entries")
    .insert({ task_id: taskId, user_id: user.id, started_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function stopTimeEntry(entryId: string) {
  const now = new Date();
  const { data: entry } = await supabase.from("task_time_entries").select("started_at").eq("id", entryId).single();
  const duration = entry ? Math.round((now.getTime() - new Date(entry.started_at).getTime()) / 1000) : 0;
  const { data, error } = await supabase
    .from("task_time_entries")
    .update({ ended_at: now.toISOString(), duration_seconds: duration })
    .eq("id", entryId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchRunningTimeEntries() {
  const { data, error } = await supabase
    .from("task_time_entries")
    .select("*")
    .is("ended_at", null);
  if (error) throw error;
  return data;
}

// ---- TASK LINKS ----
export async function createTaskLink(taskId: string, linkedTaskId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("task_links")
    .insert({ task_id: taskId, linked_task_id: linkedTaskId, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTaskLinks(taskId: string) {
  const { data, error } = await supabase
    .from("task_links")
    .select("*, linked_task:linked_task_id(id, title, status, priority, space_id, spaces(name))")
    .eq("task_id", taskId);
  if (error) throw error;
  
  // Also fetch reverse links (where this task is the linked one)
  const { data: reverseData, error: reverseError } = await supabase
    .from("task_links")
    .select("*, linked_task:task_id(id, title, status, priority, space_id, spaces(name))")
    .eq("linked_task_id", taskId);
  if (reverseError) throw reverseError;
  
  return [...(data || []), ...(reverseData || [])];
}

export async function deleteTaskLink(id: string) {
  const { error } = await supabase.from("task_links").delete().eq("id", id);
  if (error) throw error;
}

// ---- TASK MATERIALS ----
export async function fetchTaskMaterials(taskId: string) {
  const { data, error } = await (supabase as any)
    .from("task_materials")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createTaskMaterial(material: { task_id: string; title: string; url: string; description?: string | null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await (supabase as any)
    .from("task_materials")
    .insert({ ...material, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTaskMaterial(id: string) {
  const { error } = await (supabase as any).from("task_materials").delete().eq("id", id);
  if (error) throw error;
}
