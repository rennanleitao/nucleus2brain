CREATE TABLE public.meeting_copilot_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Reunião sem título',
  profile TEXT NOT NULL DEFAULT 'executive',
  status TEXT NOT NULL DEFAULT 'active',
  transcript TEXT NOT NULL DEFAULT '',
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT meeting_copilot_sessions_profile_check
    CHECK (profile IN ('sales', 'csc', 'rpa', 'executive')),
  CONSTRAINT meeting_copilot_sessions_status_check
    CHECK (status IN ('active', 'ended'))
);

CREATE TABLE public.meeting_copilot_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.meeting_copilot_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  analysis_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_copilot_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_copilot_segments TO authenticated;
GRANT ALL ON public.meeting_copilot_sessions TO service_role;
GRANT ALL ON public.meeting_copilot_segments TO service_role;

ALTER TABLE public.meeting_copilot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_copilot_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meeting copilot sessions"
ON public.meeting_copilot_sessions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own meeting copilot segments"
ON public.meeting_copilot_segments
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_meeting_copilot_sessions_user_updated
ON public.meeting_copilot_sessions(user_id, updated_at DESC);

CREATE INDEX idx_meeting_copilot_segments_session_created
ON public.meeting_copilot_segments(session_id, created_at ASC);

CREATE TRIGGER update_meeting_copilot_sessions_updated_at
BEFORE UPDATE ON public.meeting_copilot_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
