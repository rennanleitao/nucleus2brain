import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MeetingCopilotProfile = "sales" | "csc" | "rpa" | "executive";

export interface MeetingCopilotAnalysis {
  executive_summary: string;
  decisions: string[];
  risks: string[];
  unanswered_questions: string[];
  next_best_question: string;
  objections: string[];
  buying_signals: string[];
  next_steps: string[];
}

export interface MeetingCopilotSession {
  id: string;
  user_id: string;
  title: string;
  profile: MeetingCopilotProfile;
  status: "active" | "ended";
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
  executive_summary: "",
  decisions: [],
  risks: [],
  unanswered_questions: [],
  next_best_question: "",
  objections: [],
  buying_signals: [],
  next_steps: [],
};

export const MEETING_COPILOT_PROFILES: Array<{
  id: MeetingCopilotProfile;
  label: string;
  description: string;
}> = [
  {
    id: "executive",
    label: "Executive Copilot",
    description: "Decisões, riscos estratégicos, lacunas e próximos passos executivos.",
  },
  {
    id: "sales",
    label: "Sales Copilot",
    description: "Sinais de compra, objeções, stakeholders, urgência e avanço comercial.",
  },
  {
    id: "csc",
    label: "CSC Copilot",
    description: "Adoção, relacionamento, expansão, riscos de churn e bloqueios do cliente.",
  },
  {
    id: "rpa",
    label: "RPA Copilot",
    description: "Processos, automações, exceções, integrações e ganhos operacionais.",
  },
];

export function normalizeMeetingAnalysis(value: unknown): MeetingCopilotAnalysis {
  const source = value && typeof value === "object" ? value as Partial<MeetingCopilotAnalysis> : {};
  return {
    executive_summary: typeof source.executive_summary === "string" ? source.executive_summary : "",
    decisions: Array.isArray(source.decisions) ? source.decisions : [],
    risks: Array.isArray(source.risks) ? source.risks : [],
    unanswered_questions: Array.isArray(source.unanswered_questions) ? source.unanswered_questions : [],
    next_best_question: typeof source.next_best_question === "string" ? source.next_best_question : "",
    objections: Array.isArray(source.objections) ? source.objections : [],
    buying_signals: Array.isArray(source.buying_signals) ? source.buying_signals : [],
    next_steps: Array.isArray(source.next_steps) ? source.next_steps : [],
  };
}

export function useMeetingCopilotSessions() {
  return useQuery({
    queryKey: ["meeting_copilot_sessions"],
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

export function useMeetingCopilotSegments(sessionId?: string | null) {
  return useQuery({
    queryKey: ["meeting_copilot_segments", sessionId],
    enabled: !!sessionId,
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
    mutationFn: async (input: { title: string; profile: MeetingCopilotProfile }) => {
      const { data, error } = await db
        .from("meeting_copilot_sessions")
        .insert({
          user_id: user!.id,
          title: input.title,
          profile: input.profile,
          status: "active",
          analysis: EMPTY_MEETING_ANALYSIS,
        })
        .select()
        .single();
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
      const { data, error } = await db
        .from("meeting_copilot_sessions")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as MeetingCopilotSession;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["meeting_copilot_sessions"] });
      qc.invalidateQueries({ queryKey: ["meeting_copilot_segments", input.id] });
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
    }) => {
      const { data, error } = await db
        .from("meeting_copilot_segments")
        .insert({
          user_id: user!.id,
          session_id: input.session_id,
          content: input.content,
          analysis_snapshot: input.analysis_snapshot ?? null,
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
