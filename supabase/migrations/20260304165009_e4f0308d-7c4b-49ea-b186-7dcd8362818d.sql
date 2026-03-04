CREATE TABLE public.tagged_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  note_id uuid REFERENCES public.notes(id) ON DELETE CASCADE NOT NULL,
  tag text NOT NULL,
  snippet_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tagged_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tagged_snippets" ON public.tagged_snippets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
