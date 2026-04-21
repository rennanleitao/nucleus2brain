-- Add soft delete column to tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Index for filtering and cleanup
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON public.tasks (deleted_at) WHERE deleted_at IS NOT NULL;

-- Cleanup function: hard-delete tasks soft-deleted more than 24h ago
CREATE OR REPLACE FUNCTION public.purge_old_deleted_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.tasks
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '1 day';
END;
$$;