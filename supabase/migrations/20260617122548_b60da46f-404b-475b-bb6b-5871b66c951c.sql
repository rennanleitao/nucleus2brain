
-- Drop old tables (cascade removes related trigger)
DROP TABLE IF EXISTS public.study_updates CASCADE;
DROP TABLE IF EXISTS public.study_sources CASCADE;
DROP TABLE IF EXISTS public.book_summaries CASCADE;

-- Simplify study_topics
ALTER TABLE public.study_topics DROP COLUMN IF EXISTS status;
ALTER TABLE public.study_topics DROP COLUMN IF EXISTS current_reading;
ALTER TABLE public.study_topics DROP COLUMN IF EXISTS tracking_points;

-- Drop unused enums
DROP TYPE IF EXISTS public.study_topic_status;
DROP TYPE IF EXISTS public.study_update_type;
DROP TYPE IF EXISTS public.study_source_type;

-- Create simplified entries table
CREATE TABLE public.study_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topic_id UUID NOT NULL REFERENCES public.study_topics(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_url TEXT,
  highlight TEXT,
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_entries TO authenticated;
GRANT ALL ON public.study_entries TO service_role;

ALTER TABLE public.study_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own study entries"
ON public.study_entries FOR ALL
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_study_entries_topic_date ON public.study_entries(topic_id, entry_date DESC);
CREATE INDEX idx_study_entries_user ON public.study_entries(user_id);

CREATE TRIGGER update_study_entries_updated_at
BEFORE UPDATE ON public.study_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Replace bump trigger to use study_entries
CREATE OR REPLACE FUNCTION public.bump_study_topic_last_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.study_topics SET last_updated_at = now() WHERE id = NEW.topic_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bump_topic_on_entry
AFTER INSERT OR UPDATE ON public.study_entries
FOR EACH ROW EXECUTE FUNCTION public.bump_study_topic_last_updated();
