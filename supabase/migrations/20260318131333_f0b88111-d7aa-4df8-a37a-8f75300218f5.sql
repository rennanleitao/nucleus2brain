-- Fix: Allow space members to view each other's profiles
CREATE POLICY "Space members can view each other profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.space_members sm1
    JOIN public.space_members sm2 ON sm1.space_id = sm2.space_id
    WHERE sm1.user_id = auth.uid() AND sm2.user_id = profiles.user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.spaces s
    JOIN public.space_members sm ON s.id = sm.space_id
    WHERE (s.user_id = auth.uid() AND sm.user_id = profiles.user_id)
       OR (sm.user_id = auth.uid() AND s.user_id = profiles.user_id)
  )
);

-- Note sharing tables
CREATE TABLE public.note_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  share_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_by uuid NOT NULL,
  allow_edit boolean NOT NULL DEFAULT true,
  allow_ai boolean NOT NULL DEFAULT true,
  allow_comments boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(note_id)
);

ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Note owners manage shares"
ON public.note_shares FOR ALL
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Anyone can read share by token"
ON public.note_shares FOR SELECT
TO anon, authenticated
USING (true);

-- Guest identification
CREATE TABLE public.note_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL,
  guest_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guest_token)
);

ALTER TABLE public.note_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create and read guests"
ON public.note_guests FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Comments on shared notes
CREATE TABLE public.note_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id uuid,
  guest_id uuid REFERENCES public.note_guests(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  author_name text NOT NULL
);

ALTER TABLE public.note_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read note comments"
ON public.note_comments FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can insert comments"
ON public.note_comments FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Authors can delete own comments"
ON public.note_comments FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Edit history
CREATE TABLE public.note_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id uuid,
  guest_id uuid REFERENCES public.note_guests(id) ON DELETE SET NULL,
  editor_name text NOT NULL,
  change_summary text,
  content_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.note_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Note owners can read edit history"
ON public.note_edit_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.notes WHERE id = note_edit_history.note_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can insert edit history"
ON public.note_edit_history FOR INSERT
TO anon, authenticated
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.note_comments;