-- Make task_id optional and add space_id + tag for standalone materials
ALTER TABLE public.task_materials ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE public.task_materials ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES public.spaces(id) ON DELETE SET NULL;
ALTER TABLE public.task_materials ADD COLUMN IF NOT EXISTS tag text;
CREATE INDEX IF NOT EXISTS idx_task_materials_space_id ON public.task_materials(space_id);
CREATE INDEX IF NOT EXISTS idx_task_materials_tag ON public.task_materials(tag);