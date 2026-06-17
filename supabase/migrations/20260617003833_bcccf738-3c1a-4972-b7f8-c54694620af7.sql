-- Enums
CREATE TYPE public.study_topic_status AS ENUM ('monitorar', 'em_mudanca', 'estavel', 'pressionado', 'critico', 'arquivado');
CREATE TYPE public.study_update_type AS ENUM ('noticia', 'artigo', 'livro', 'relatorio', 'video', 'paper', 'insight', 'reuniao');
CREATE TYPE public.study_source_type AS ENUM ('noticia', 'blog_oficial', 'relatorio', 'paper', 'livro', 'video', 'podcast', 'documento_oficial');

-- study_areas
CREATE TABLE public.study_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_areas TO authenticated;
GRANT ALL ON public.study_areas TO service_role;
ALTER TABLE public.study_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own study_areas" ON public.study_areas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER study_areas_updated_at BEFORE UPDATE ON public.study_areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_study_areas_user ON public.study_areas(user_id);

-- study_topics
CREATE TABLE public.study_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  area_id uuid NOT NULL REFERENCES public.study_areas(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  current_reading text,
  status public.study_topic_status NOT NULL DEFAULT 'monitorar',
  tags text[] NOT NULL DEFAULT '{}',
  tracking_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_topics TO authenticated;
GRANT ALL ON public.study_topics TO service_role;
ALTER TABLE public.study_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own study_topics" ON public.study_topics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER study_topics_updated_at BEFORE UPDATE ON public.study_topics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_study_topics_user ON public.study_topics(user_id);
CREATE INDEX idx_study_topics_area ON public.study_topics(area_id);

-- study_updates
CREATE TABLE public.study_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic_id uuid NOT NULL REFERENCES public.study_topics(id) ON DELETE CASCADE,
  type public.study_update_type NOT NULL DEFAULT 'noticia',
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  title text NOT NULL,
  summary text NOT NULL,
  why_it_matters text,
  what_changed text,
  source_name text,
  source_url text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_updates TO authenticated;
GRANT ALL ON public.study_updates TO service_role;
ALTER TABLE public.study_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own study_updates" ON public.study_updates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER study_updates_updated_at BEFORE UPDATE ON public.study_updates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_study_updates_topic ON public.study_updates(topic_id);
CREATE INDEX idx_study_updates_user ON public.study_updates(user_id);

-- study_sources
CREATE TABLE public.study_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic_id uuid NOT NULL REFERENCES public.study_topics(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text,
  source_type public.study_source_type NOT NULL DEFAULT 'noticia',
  captured_at date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sources TO authenticated;
GRANT ALL ON public.study_sources TO service_role;
ALTER TABLE public.study_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own study_sources" ON public.study_sources FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER study_sources_updated_at BEFORE UPDATE ON public.study_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_study_sources_topic ON public.study_sources(topic_id);

-- book_summaries
CREATE TABLE public.book_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic_id uuid REFERENCES public.study_topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  year int,
  executive_summary text,
  main_ideas text,
  key_concepts text,
  relevant_quotes text,
  practical_applications text,
  review_questions text,
  notebooklm_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_summaries TO authenticated;
GRANT ALL ON public.book_summaries TO service_role;
ALTER TABLE public.book_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own book_summaries" ON public.book_summaries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER book_summaries_updated_at BEFORE UPDATE ON public.book_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_book_summaries_topic ON public.book_summaries(topic_id);
CREATE INDEX idx_book_summaries_user ON public.book_summaries(user_id);

-- Trigger to bump topic.last_updated_at when an update is added/edited
CREATE OR REPLACE FUNCTION public.bump_study_topic_last_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.study_topics SET last_updated_at = now() WHERE id = NEW.topic_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER study_updates_bump_topic AFTER INSERT OR UPDATE ON public.study_updates
  FOR EACH ROW EXECUTE FUNCTION public.bump_study_topic_last_updated();