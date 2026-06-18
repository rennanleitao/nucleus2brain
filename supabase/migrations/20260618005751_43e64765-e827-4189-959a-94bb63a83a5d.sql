ALTER TABLE public.study_entries
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE public.study_entries
  ALTER COLUMN entry_date DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'study_entries_kind_check'
  ) THEN
    ALTER TABLE public.study_entries
      ADD CONSTRAINT study_entries_kind_check CHECK (kind IN ('event','knowledge'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_study_entries_kind ON public.study_entries(topic_id, kind);