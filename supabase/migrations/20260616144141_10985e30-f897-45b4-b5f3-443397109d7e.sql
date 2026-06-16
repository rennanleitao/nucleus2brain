
CREATE TABLE public.note_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_templates TO authenticated;
GRANT ALL ON public.note_templates TO service_role;

ALTER TABLE public.note_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own note templates"
ON public.note_templates
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_note_templates_updated_at
BEFORE UPDATE ON public.note_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
