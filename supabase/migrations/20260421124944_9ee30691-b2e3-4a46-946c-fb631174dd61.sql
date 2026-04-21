ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scheduled_time time;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_scheduled_time ON public.tasks(due_date, scheduled_time);