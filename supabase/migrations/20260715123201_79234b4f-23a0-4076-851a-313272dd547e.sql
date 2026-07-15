ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS delegated_to text;
CREATE INDEX IF NOT EXISTS tasks_delegated_to_idx ON public.tasks (user_id) WHERE delegated_to IS NOT NULL;