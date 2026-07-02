ALTER TABLE public.meeting_copilot_sessions
  ADD COLUMN IF NOT EXISTS theme TEXT,
  ADD COLUMN IF NOT EXISTS capture_type TEXT NOT NULL DEFAULT 'conversation';

CREATE INDEX IF NOT EXISTS idx_meeting_copilot_sessions_theme
ON public.meeting_copilot_sessions(user_id, theme)
WHERE theme IS NOT NULL;
