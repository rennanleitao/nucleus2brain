
CREATE TABLE public.gmail_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_api_key TEXT NOT NULL,
  email TEXT,
  scopes TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT (user_id, email, scopes, connected_at, updated_at) ON public.gmail_connections TO authenticated;
GRANT ALL ON public.gmail_connections TO service_role;
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gmail connection meta" ON public.gmail_connections
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER gmail_connections_updated_at BEFORE UPDATE ON public.gmail_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.gmail_oauth_sessions (
  session_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.gmail_oauth_sessions TO service_role;
ALTER TABLE public.gmail_oauth_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  thread_id TEXT,
  subject TEXT,
  from_address TEXT,
  snippet TEXT,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_link_target_check CHECK (task_id IS NOT NULL OR note_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_task_links TO authenticated;
GRANT ALL ON public.email_task_links TO service_role;
ALTER TABLE public.email_task_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own email links" ON public.email_task_links
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_email_task_links_user ON public.email_task_links(user_id);
CREATE INDEX idx_email_task_links_msg ON public.email_task_links(user_id, message_id);
CREATE INDEX idx_email_task_links_task ON public.email_task_links(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_email_task_links_note ON public.email_task_links(note_id) WHERE note_id IS NOT NULL;
