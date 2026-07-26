ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS subtasks_task_position_idx ON public.subtasks (task_id, position, created_at);
-- Seed positions for existing rows using created_at order per task.
WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY task_id ORDER BY created_at) AS rn
  FROM public.subtasks
)
UPDATE public.subtasks s SET position = o.rn FROM ordered o WHERE s.id = o.id;