CREATE TABLE public.space_task_themes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
 name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.space_task_themes TO authenticated;
GRANT ALL ON public.space_task_themes TO service_role;
ALTER TABLE public.space_task_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read task themes" ON public.space_task_themes FOR SELECT TO authenticated USING (public.is_space_member(auth.uid(), space_id));
CREATE POLICY "Members create task themes" ON public.space_task_themes FOR INSERT TO authenticated WITH CHECK (public.is_space_member(auth.uid(), space_id));
CREATE UNIQUE INDEX space_task_themes_unique_name ON public.space_task_themes(space_id, lower(name));
ALTER TABLE public.tasks ADD COLUMN themes text[] NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION public.validate_task_themes() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE theme_name text; canonical_name text; normalized text[] := '{}';
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF NEW.space_id IS DISTINCT FROM OLD.space_id AND NEW.themes IS NOT DISTINCT FROM OLD.themes THEN NEW.themes := '{}'; END IF;
 END IF;
 NEW.themes := coalesce(NEW.themes, '{}');
 IF cardinality(NEW.themes) > 0 AND NEW.space_id IS NULL THEN
  RAISE EXCEPTION 'Selecione um Space antes de adicionar Temas.' USING ERRCODE = '23514';
 END IF;
 FOR theme_name IN SELECT DISTINCT regexp_replace(btrim(t), '\s+', ' ', 'g') FROM unnest(NEW.themes) t WHERE btrim(t) <> '' LOOP
  INSERT INTO public.space_task_themes(space_id, name) VALUES (NEW.space_id, theme_name) ON CONFLICT DO NOTHING;
  SELECT name INTO canonical_name FROM public.space_task_themes WHERE space_id = NEW.space_id AND lower(name) = lower(theme_name);
  IF canonical_name IS NULL THEN RAISE EXCEPTION 'Tema indisponível neste Space.'; END IF;
  IF NOT canonical_name = ANY(normalized) THEN normalized := array_append(normalized, canonical_name); END IF;
 END LOOP;
 NEW.themes := normalized;
 RETURN NEW;
END;
$$;
CREATE TRIGGER validate_task_themes_before_save BEFORE INSERT OR UPDATE OF themes, space_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.validate_task_themes();