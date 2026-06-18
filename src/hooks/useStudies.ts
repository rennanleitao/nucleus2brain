import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Local types (types.ts may be stale until regen)
export interface StudyArea {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyTopic {
  id: string;
  user_id: string;
  area_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  tags: string[] | null;
  last_updated_at: string | null;
  created_at: string;
  updated_at: string;
}


export type StudyEntryKind = "event" | "knowledge";

export interface StudyEntry {
  id: string;
  user_id: string;
  topic_id: string;
  kind: StudyEntryKind;
  entry_date: string | null; // YYYY-MM-DD (required for events, optional for knowledge)
  title: string;
  summary: string;
  category: string | null;       // knowledge: Framework, Conceito, Livro, Playbook, Prompt...
  content: string | null;        // knowledge: long-form main content
  source_url: string | null;
  highlight: string | null;      // events: highlight quote/data
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const db = supabase as any;

// ---------- Areas ----------
export function useStudyAreas() {
  return useQuery({
    queryKey: ["study_areas"],
    queryFn: async () => {
      const { data, error } = await db
        .from("study_areas")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StudyArea[];
    },
  });
}

export function useCreateArea() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<StudyArea> & { name: string }) => {
      const { data, error } = await db
        .from("study_areas")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as StudyArea;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_areas"] }),
  });
}

export function useUpdateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<StudyArea> & { id: string }) => {
      const { data, error } = await db
        .from("study_areas")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as StudyArea;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_areas"] }),
  });
}

export function useDeleteArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("study_areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_areas"] });
      qc.invalidateQueries({ queryKey: ["study_topics"] });
    },
  });
}

// ---------- Topics ----------
export function useStudyTopics(areaId?: string | null) {
  return useQuery({
    queryKey: ["study_topics", areaId ?? "all"],
    queryFn: async () => {
      let q = db.from("study_topics").select("*").order("updated_at", { ascending: false });
      if (areaId) q = q.eq("area_id", areaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as StudyTopic[];
    },
  });
}

export function useCreateTopic() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<StudyTopic> & { title: string; area_id: string }) => {
      const { data, error } = await db
        .from("study_topics")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as StudyTopic;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_topics"] }),
  });
}

export function useUpdateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<StudyTopic> & { id: string }) => {
      const { data, error } = await db
        .from("study_topics")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as StudyTopic;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_topics"] }),
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("study_topics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_topics"] }),
  });
}

// ---------- Entries (timeline) ----------
export function useStudyEntries(topicId?: string | null) {
  return useQuery({
    queryKey: ["study_entries", topicId],
    enabled: !!topicId,
    queryFn: async () => {
      const { data, error } = await db
        .from("study_entries")
        .select("*")
        .eq("topic_id", topicId!)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StudyEntry[];
    },
  });
}

export function useAllRecentEntries(limit = 10) {
  return useQuery({
    queryKey: ["study_entries_recent", limit],
    queryFn: async () => {
      const { data, error } = await db
        .from("study_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as StudyEntry[];
    },
  });
}

export function useCreateEntry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (
      input: Partial<StudyEntry> & { topic_id: string; title: string; summary: string; entry_date: string }
    ) => {
      const { data, error } = await db
        .from("study_entries")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as StudyEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_entries"] });
      qc.invalidateQueries({ queryKey: ["study_entries_recent"] });
      qc.invalidateQueries({ queryKey: ["study_topics"] });
    },
  });
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<StudyEntry> & { id: string }) => {
      const { data, error } = await db
        .from("study_entries")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as StudyEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_entries"] });
      qc.invalidateQueries({ queryKey: ["study_entries_recent"] });
    },
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("study_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_entries"] });
      qc.invalidateQueries({ queryKey: ["study_entries_recent"] });
    },
  });
}

export function useMoveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, topic_id }: { id: string; topic_id: string }) => {
      const { data, error } = await db
        .from("study_entries")
        .update({ topic_id })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as StudyEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_entries"] });
      qc.invalidateQueries({ queryKey: ["study_entries_recent"] });
      qc.invalidateQueries({ queryKey: ["study_topics"] });
    },
  });
}

export function useDuplicateEntry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ entry, topic_id }: { entry: StudyEntry; topic_id: string }) => {
      const { id, created_at, updated_at, user_id, topic_id: _t, ...rest } = entry;
      const { data, error } = await db
        .from("study_entries")
        .insert({ ...rest, topic_id, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as StudyEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_entries"] });
      qc.invalidateQueries({ queryKey: ["study_entries_recent"] });
      qc.invalidateQueries({ queryKey: ["study_topics"] });
    },
  });
}

