ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence text
    CHECK (recurrence IS NULL OR recurrence IN ('daily','weekly','monthly','yearly')),
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid
    REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent
  ON public.tasks(recurrence_parent_id);

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence
  ON public.tasks(recurrence) WHERE recurrence IS NOT NULL;