
-- Create enum for space member roles
CREATE TYPE public.space_role AS ENUM ('owner', 'editor', 'viewer');

-- Space members table
CREATE TABLE public.space_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role space_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(space_id, user_id)
);

ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;

-- Space invites table (for link-based invites)
CREATE TABLE public.space_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL,
  invited_email TEXT,
  invite_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  role space_role NOT NULL DEFAULT 'viewer',
  accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.space_invites ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is a member of a space
CREATE OR REPLACE FUNCTION public.is_space_member(_user_id UUID, _space_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spaces WHERE id = _space_id AND user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.space_members WHERE space_id = _space_id AND user_id = _user_id
  )
$$;

-- Security definer function to check if user can edit a space
CREATE OR REPLACE FUNCTION public.can_edit_space(_user_id UUID, _space_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spaces WHERE id = _space_id AND user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.space_members WHERE space_id = _space_id AND user_id = _user_id AND role IN ('owner', 'editor')
  )
$$;

-- RLS for space_members: owners can manage, members can view
CREATE POLICY "Space owners manage members"
  ON public.space_members FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.spaces WHERE id = space_id AND user_id = auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.spaces WHERE id = space_id AND user_id = auth.uid())
  );

-- RLS for space_invites: owners can manage
CREATE POLICY "Space owners manage invites"
  ON public.space_invites FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.spaces WHERE id = space_id AND user_id = auth.uid())
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.spaces WHERE id = space_id AND user_id = auth.uid())
  );

-- Update spaces RLS to allow members to view
DROP POLICY IF EXISTS "Users manage own spaces" ON public.spaces;

CREATE POLICY "Users manage own spaces"
  ON public.spaces FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.is_space_member(auth.uid(), id))
  WITH CHECK (user_id = auth.uid());

-- Update tasks RLS to allow shared space members
DROP POLICY IF EXISTS "Users manage own tasks" ON public.tasks;

CREATE POLICY "Users manage own tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (space_id IS NOT NULL AND public.is_space_member(auth.uid(), space_id)));

CREATE POLICY "Users insert own tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND (space_id IS NULL OR public.can_edit_space(auth.uid(), space_id)));

CREATE POLICY "Users update own tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR (space_id IS NOT NULL AND public.can_edit_space(auth.uid(), space_id)))
  WITH CHECK (user_id = auth.uid() OR (space_id IS NOT NULL AND public.can_edit_space(auth.uid(), space_id)));

CREATE POLICY "Users delete own tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR (space_id IS NOT NULL AND public.can_edit_space(auth.uid(), space_id)));

-- Update notes RLS
DROP POLICY IF EXISTS "Users manage own notes" ON public.notes;

CREATE POLICY "Users manage own notes"
  ON public.notes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (space_id IS NOT NULL AND public.is_space_member(auth.uid(), space_id)));

CREATE POLICY "Users insert own notes"
  ON public.notes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND (space_id IS NULL OR public.can_edit_space(auth.uid(), space_id)));

CREATE POLICY "Users update own notes"
  ON public.notes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR (space_id IS NOT NULL AND public.can_edit_space(auth.uid(), space_id)))
  WITH CHECK (user_id = auth.uid() OR (space_id IS NOT NULL AND public.can_edit_space(auth.uid(), space_id)));

CREATE POLICY "Users delete own notes"
  ON public.notes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR (space_id IS NOT NULL AND public.can_edit_space(auth.uid(), space_id)));

-- Update links RLS
DROP POLICY IF EXISTS "Users manage own links" ON public.links;

CREATE POLICY "Users manage own links"
  ON public.links FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (space_id IS NOT NULL AND public.is_space_member(auth.uid(), space_id)));

CREATE POLICY "Users insert own links"
  ON public.links FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND (space_id IS NULL OR public.can_edit_space(auth.uid(), space_id)));

CREATE POLICY "Users update delete own links"
  ON public.links FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR (space_id IS NOT NULL AND public.can_edit_space(auth.uid(), space_id)));

-- Update attachments RLS
DROP POLICY IF EXISTS "Users manage own attachments" ON public.attachments;

CREATE POLICY "Users manage own attachments"
  ON public.attachments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (space_id IS NOT NULL AND public.is_space_member(auth.uid(), space_id)));

CREATE POLICY "Users insert own attachments"
  ON public.attachments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND (space_id IS NULL OR public.can_edit_space(auth.uid(), space_id)));

CREATE POLICY "Users delete own attachments"
  ON public.attachments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR (space_id IS NOT NULL AND public.can_edit_space(auth.uid(), space_id)));
