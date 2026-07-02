import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MeetingCopilotProfile = "sales" | "csc" | "rpa" | "executive";

export interface MeetingCopilotAnalysis {
  summary: string;
  theme_suggestion: string;
  related_themes: string[];
  key_topics: string[];
  decisions: string[];
  action_items: string[];
  open_questions: string[];
  people: string[];
  tags: string[];
  confidence: number;
}

export interface MeetingCopilotSession {
  id: string;
  user_id: string;
  title: string;
  profile: MeetingCopilotProfile;
  theme: string | null;
  capture_type: string | null;
  status: "active" | "ended";
  provider: string | null;
  meeting_url: string | null;
  bot_id: string | null;
  bot_name: string | null;
  bot_status: string | null;
  bot_error: string | null;
  bot_joined_at: string | null;
  bot_left_at: string | null;
  transcript: string;
  analysis: MeetingCopilotAnalysis | Record<string, never>;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingCopilotSegment {
  id: string;
  user_id: string;
  session_id: string;
  content: string;
  analysis_snapshot: MeetingCopilotAnalysis | null;
  speaker_name: string | null;
  relative_start_seconds: number | null;
  source: "manual" | "browser" | "recall";
  created_at: string;
}

interface SupabaseMutationResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

interface SupabaseQueryBuilder {
  select(columns?: string): SupabaseQueryBuilder;
  insert(value: unknown): SupabaseQueryBuilder;
  update(value: unknown): SupabaseQueryBuilder;
  delete(): SupabaseQueryBuilder;
  eq(column: string, value: unknown): SupabaseQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder;
  limit(count: number): SupabaseQueryBuilder;
  single<T = unknown>(): Promise<SupabaseMutationResult<T>>;
  then<TResult1 = SupabaseMutationResult<unknown[]>, TResult2 = never>(
    onfulfilled?: ((value: SupabaseMutationResult<unknown[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

const db = supabase as unknown as {
  from(table: "meeting_copilot_sessions" | "meeting_copilot_segments"): SupabaseQueryBuilder;
};

export const EMPTY_MEETING_ANALYSIS: MeetingCopilotAnalysis = {
  summary: "",
  theme_suggestion: "",
  related_themes: [],
  key_topics: [],
  decisions: [],
  action_items: [],
  open_questions: [],
  people: [],
  tags: [],
  confidence: 0,
};

export const MEETING_COPILOT_PROFILES: Array<{
  id: MeetingCopilotProfile;
  label: string;
  description: string;
}> = [
  {
    id: "executive",
    label: "Geral",
    description: "Resumo objetivo, decisões, tarefas e perguntas abertas da conversa.",
  },
  {
    id: "sales",
    label: "Cliente/Vendas",
    description: "Conversas comerciais, clientes, objeções, próximos passos e follow-ups.",
  },
  {
    id: "csc",
    label: "Relacionamento",
    description: "Acompanhamentos, alinhamentos, expectativas, bloqueios e satisfação.",
  },
  {
    id: "rpa",
    label: "Processos",
    description: "Processos, operações, automações, exceções, integrações e melhorias.",
  },
];

export function normalizeMeetingAnalysis(value: unknown): MeetingCopilotAnalysis {
  const source = value && typeof value === "object" ? value as Partial<MeetingCopilotAnalysis> : {};
  const legacy = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    summary: typeof source.summary === "string"
      ? source.summary
      : typeof legacy.executive_summary === "string" ? legacy.executive_summary : "",
    theme_suggestion: typeof source.theme_suggestion === "string" ? source.theme_suggestion : "",
    related_themes: Array.isArray(source.related_themes) ? source.related_themes : [],
    key_topics: Array.isArray(source.key_topics) ? source.key_topics : [],
    decisions: Array.isArray(source.decisions) ? source.decisions : [],
    action_items: Array.isArray(source.action_items)
      ? source.action_items
      : Array.isArray(legacy.next_steps) ? legacy.next_steps as string[] : [],
    open_questions: Array.isArray(source.open_questions)
      ? source.open_questions
      : Array.isArray(legacy.unanswered_questions) ? legacy.unanswered_questions as string[] : [],
    people: Array.isArray(source.people) ? source.people : [],
    tags: Array.isArray(source.tags) ? source.tags : [],
    confidence: typeof source.confidence === "number" ? source.confidence : 0,
  };
}

export function useMeetingCopilotSessions() {
  return useQuery({
    queryKey: ["meeting_copilot_sessions"],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await db
        .from("meeting_copilot_sessions")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map((session: MeetingCopilotSession) => ({
        ...session,
        analysis: normalizeMeetingAnalysis(session.analysis),
      })) as MeetingCopilotSession[];
    },
  });
}

export function useMeetingCopilotSession(sessionId?: string | null) {
  return useQuery({
    queryKey: ["meeting_copilot_sessions", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await db
        .from("meeting_copilot_sessions")
        .select("*")
        .eq("id", sessionId!)
        .single<MeetingCopilotSession>();
      if (error) throw error;
      return {
        ...data,
        analysis: normalizeMeetingAnalysis(data.analysis),
      } as MeetingCopilotSession;
    },
  });
}

export function useMeetingCopilotSegments(sessionId?: string | null) {
  return useQuery({
    queryKey: ["meeting_copilot_segments", sessionId],
    enabled: !!sessionId,
    refetchInterval: sessionId ? 3000 : false,
    queryFn: async () => {
      const { data, error } = await db
        .from("meeting_copilot_segments")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MeetingCopilotSegment[];
    },
  });
}

export function useCreateMeetingCopilotSession() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { title: string; profile: MeetingCopilotProfile; theme?: string | null; capture_type?: string | null }) => {
      const payload = {
        user_id: user!.id,
        title: input.title,
        profile: input.profile,
        theme: input.theme ?? null,
        capture_type: input.capture_type ?? "conversation",
        status: "active",
        analysis: EMPTY_MEETING_ANALYSIS,
      };

      let { data, error } = await db
        .from("meeting_copilot_sessions")
        .insert(payload)
        .select()
        .single();

      if (error && error.message.toLowerCase().includes("column")) {
        const fallbackPayload = {
          user_id: user!.id,
          title: input.title,
          profile: input.profile,
          status: "active",
          analysis: EMPTY_MEETING_ANALYSIS,
        };
        const fallback = await db
          .from("meeting_copilot_sessions")
          .insert(fallbackPayload)
          .select()
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      return data as MeetingCopilotSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_copilot_sessions"] }),
  });
}

export function useUpdateMeetingCopilotSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<MeetingCopilotSession> & { id: string }) => {
      let { data, error } = await db
        .from("meeting_copilot_sessions")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error && error.message.toLowerCase().includes("column")) {
        const { theme: _theme, capture_type: _captureType, ...fallbackPatch } = patch;
        const fallback = await db
          .from("meeting_copilot_sessions")
          .update(fallbackPatch)
          .eq("id", id)
          .select()
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      return data as MeetingCopilotSession;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["meeting_copilot_sessions"] });
      qc.invalidateQueries({ queryKey: ["meeting_copilot_segments", input.id] });
    },
  });
}

export function useDeleteMeetingCopilotSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db
        .from("meeting_copilot_sessions")
        .delete()
        .eq("id", id)
        .select("id")
        .single<{ id: string }>();
      if (error) throw error;
      return data;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["meeting_copilot_sessions"] });
      const previousSessions = qc.getQueryData<MeetingCopilotSession[]>(["meeting_copilot_sessions"]);

      qc.setQueryData<MeetingCopilotSession[]>(["meeting_copilot_sessions"], (current = []) => (
        current.filter((session) => session.id !== id)
      ));
      qc.removeQueries({ queryKey: ["meeting_copilot_sessions", id] });
      qc.removeQueries({ queryKey: ["meeting_copilot_segments", id] });

      return { previousSessions };
    },
    onError: (_error, _id, context) => {
      if (context?.previousSessions) {
        qc.setQueryData(["meeting_copilot_sessions"], context.previousSessions);
      }
    },
    onSettled: (_data, _error, id) => {
      qc.invalidateQueries({ queryKey: ["meeting_copilot_sessions"] });
      qc.removeQueries({ queryKey: ["meeting_copilot_sessions", id] });
      qc.removeQueries({ queryKey: ["meeting_copilot_segments", id] });
    },
  });
}

export function useCreateMeetingCopilotSegment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      session_id: string;
      content: string;
      analysis_snapshot?: MeetingCopilotAnalysis | null;
      speaker_name?: string | null;
      relative_start_seconds?: number | null;
      source?: "manual" | "browser" | "recall";
    }) => {
      const { data, error } = await db
        .from("meeting_copilot_segments")
        .insert({
          user_id: user!.id,
          session_id: input.session_id,
          content: input.content,
          analysis_snapshot: input.analysis_snapshot ?? null,
          speaker_name: input.speaker_name ?? null,
          relative_start_seconds: input.relative_start_seconds ?? null,
          source: input.source ?? "manual",
        })
        .select()
        .single();
      if (error) throw error;
      return data as MeetingCopilotSegment;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["meeting_copilot_segments", input.session_id] });
      qc.invalidateQueries({ queryKey: ["meeting_copilot_sessions"] });
    },
  });
}
