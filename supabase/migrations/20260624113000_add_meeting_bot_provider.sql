ALTER TABLE public.meeting_copilot_sessions
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS meeting_url TEXT,
  ADD COLUMN IF NOT EXISTS bot_id TEXT,
  ADD COLUMN IF NOT EXISTS bot_name TEXT,
  ADD COLUMN IF NOT EXISTS bot_status TEXT,
  ADD COLUMN IF NOT EXISTS bot_error TEXT,
  ADD COLUMN IF NOT EXISTS bot_joined_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS bot_left_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.meeting_copilot_segments
  ADD COLUMN IF NOT EXISTS speaker_name TEXT,
  ADD COLUMN IF NOT EXISTS relative_start_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_meeting_copilot_sessions_bot_id
ON public.meeting_copilot_sessions(bot_id)
WHERE bot_id IS NOT NULL;
