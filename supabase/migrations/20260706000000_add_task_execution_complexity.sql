DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_execution_complexity') THEN
    CREATE TYPE public.task_execution_complexity AS ENUM ('easy', 'medium', 'hard');
  END IF;
END
$$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS execution_complexity public.task_execution_complexity NOT NULL DEFAULT 'medium';

CREATE INDEX IF NOT EXISTS idx_tasks_execution_complexity
  ON public.tasks(user_id, execution_complexity);
