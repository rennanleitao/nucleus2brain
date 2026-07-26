ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS shift text
CHECK (shift IS NULL OR shift IN ('morning','afternoon','night'));