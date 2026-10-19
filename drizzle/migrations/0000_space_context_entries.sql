CREATE TABLE public.space_context_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'Timeline',
  title text NOT NULL,
  content text,
  entry_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_context_entries TO authenticated;
GRANT ALL ON public.space_context_entries TO service_role;
ALTER TABLE public.space_context_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read context" ON public.space_context_entries FOR SELECT TO authenticated
  USING (public.is_space_member(auth.uid(), space_id));
CREATE POLICY "editors insert context" ON public.space_context_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_edit_space(auth.uid(), space_id));
CREATE POLICY "editors update context" ON public.space_context_entries FOR UPDATE TO authenticated
  USING (public.can_edit_space(auth.uid(), space_id));
CREATE POLICY "editors delete context" ON public.space_context_entries FOR DELETE TO authenticated
  USING (public.can_edit_space(auth.uid(), space_id));
CREATE INDEX ON public.space_context_entries (space_id, entry_date DESC);
CREATE TRIGGER trg_space_context_updated BEFORE UPDATE ON public.space_context_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();