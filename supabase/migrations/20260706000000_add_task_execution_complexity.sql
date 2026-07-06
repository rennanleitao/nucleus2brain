CREATE TYPE public.task_execution_complexity AS ENUM ('easy', 'medium', 'hard');

ALTER TABLE public.tasks
  ADD COLUMN execution_complexity public.task_execution_complexity NOT NULL DEFAULT 'medium';

CREATE INDEX IF NOT EXISTS idx_tasks_execution_complexity
  ON public.tasks(user_id, execution_complexity);
