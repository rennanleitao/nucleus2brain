
CREATE TABLE public.space_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_categories TO authenticated;
GRANT ALL ON public.space_categories TO service_role;

ALTER TABLE public.space_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own space categories"
  ON public.space_categories
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.spaces
  ADD COLUMN category_id uuid REFERENCES public.space_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_spaces_category_id ON public.spaces(category_id);
