import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

export type StudyArea = Database["public"]["Tables"]["study_areas"]["Row"];
export type StudyTopic = Database["public"]["Tables"]["study_topics"]["Row"];
export type StudyUpdate = Database["public"]["Tables"]["study_updates"]["Row"];
export type StudySource = Database["public"]["Tables"]["study_sources"]["Row"];
export type BookSummary = Database["public"]["Tables"]["book_summaries"]["Row"];
export type StudyTopicStatus = Database["public"]["Enums"]["study_topic_status"];
export type StudyUpdateType = Database["public"]["Enums"]["study_update_type"];
export type StudySourceType = Database["public"]["Enums"]["study_source_type"];

export const TOPIC_STATUS_LABELS: Record<StudyTopicStatus, string> = {
  monitorar: "Monitorar",
  em_mudanca: "Em mudança",
  estavel: "Estável",
  pressionado: "Pressionado",
  critico: "Crítico",
  arquivado: "Arquivado",
};

export const UPDATE_TYPE_LABELS: Record<StudyUpdateType, string> = {
  noticia: "Notícia",
  artigo: "Artigo",
  livro: "Livro",
  relatorio: "Relatório",
  video: "Vídeo",
  paper: "Paper",
  insight: "Insight pessoal",
  reuniao: "Reunião",
};

export const SOURCE_TYPE_LABELS: Record<StudySourceType, string> = {
  noticia: "Notícia",
  blog_oficial: "Blog oficial",
  relatorio: "Relatório",
  paper: "Paper",
  livro: "Livro",
  video: "Vídeo",
  podcast: "Podcast",
  documento_oficial: "Documento oficial",
};

// ---------- Areas ----------
export function useStudyAreas() {
  return useQuery({
    queryKey: ["study_areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_areas")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as StudyArea[];
    },
  });
}

export function useCreateArea() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<StudyArea> & { name: string }) => {
      const { data, error } = await supabase
        .from("study_areas")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_areas"] }),
  });
}

export function useUpdateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<StudyArea> & { id: string }) => {
      const { data, error } = await supabase
        .from("study_areas")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_areas"] }),
  });
}

export function useDeleteArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_areas").delete().eq("id", id);
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
      let q = supabase.from("study_topics").select("*").order("updated_at", { ascending: false });
      if (areaId) q = q.eq("area_id", areaId);
      const { data, error } = await q;
      if (error) throw error;
      return data as StudyTopic[];
    },
  });
}

export function useCreateTopic() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<StudyTopic> & { title: string; area_id: string }) => {
      const { data, error } = await supabase
        .from("study_topics")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_topics"] }),
  });
}

export function useUpdateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<StudyTopic> & { id: string }) => {
      const { data, error } = await supabase
        .from("study_topics")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_topics"] }),
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_topics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_topics"] }),
  });
}

// ---------- Updates ----------
export function useStudyUpdates(topicId?: string | null) {
  return useQuery({
    queryKey: ["study_updates", topicId],
    enabled: !!topicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_updates")
        .select("*")
        .eq("topic_id", topicId!)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StudyUpdate[];
    },
  });
}

export function useAllRecentUpdates(limit = 10) {
  return useQuery({
    queryKey: ["study_updates_recent", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_updates")
        .select("*")
        .order("date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as StudyUpdate[];
    },
  });
}

export function useCreateUpdate() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<StudyUpdate> & { topic_id: string; title: string; summary: string }) => {
      const { data, error } = await supabase
        .from("study_updates")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_updates"] });
      qc.invalidateQueries({ queryKey: ["study_updates_recent"] });
      qc.invalidateQueries({ queryKey: ["study_topics"] });
    },
  });
}

export function useUpdateUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<StudyUpdate> & { id: string }) => {
      const { data, error } = await supabase
        .from("study_updates")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_updates"] });
      qc.invalidateQueries({ queryKey: ["study_updates_recent"] });
    },
  });
}

export function useDeleteUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_updates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_updates"] });
      qc.invalidateQueries({ queryKey: ["study_updates_recent"] });
    },
  });
}

// ---------- Sources ----------
export function useStudySources(topicId?: string | null) {
  return useQuery({
    queryKey: ["study_sources", topicId],
    enabled: !!topicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_sources")
        .select("*")
        .eq("topic_id", topicId!)
        .order("captured_at", { ascending: false });
      if (error) throw error;
      return data as StudySource[];
    },
  });
}

export function useCreateSource() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<StudySource> & { topic_id: string; name: string }) => {
      const { data, error } = await supabase
        .from("study_sources")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_sources"] }),
  });
}

export function useDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_sources"] }),
  });
}

// ---------- Book summaries ----------
export function useBookSummaries(topicId?: string | null) {
  return useQuery({
    queryKey: ["book_summaries", topicId],
    enabled: !!topicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_summaries")
        .select("*")
        .eq("topic_id", topicId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BookSummary[];
    },
  });
}

export function useCreateBookSummary() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<BookSummary> & { title: string }) => {
      const { data, error } = await supabase
        .from("book_summaries")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["book_summaries"] }),
  });
}

export function useDeleteBookSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("book_summaries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["book_summaries"] }),
  });
}
