
-- Table to store Telegram bot polling state (singleton)
CREATE TABLE public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;

-- Table to map Telegram chat_id to Nucleus user_id
CREATE TABLE public.telegram_chat_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chat_id bigint NOT NULL UNIQUE,
  username text,
  linked_at timestamptz NOT NULL DEFAULT now(),
  enabled boolean NOT NULL DEFAULT true
);

ALTER TABLE public.telegram_chat_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own telegram links" ON public.telegram_chat_links
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all links (for edge functions)
CREATE POLICY "Service can read all links" ON public.telegram_chat_links
  FOR SELECT TO service_role
  USING (true);

-- Table to store incoming Telegram messages
CREATE TABLE public.telegram_messages (
  update_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  text text,
  raw_update jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages (chat_id);

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

-- Add link_code column to telegram_chat_links for verification
ALTER TABLE public.telegram_chat_links ADD COLUMN link_code text;
