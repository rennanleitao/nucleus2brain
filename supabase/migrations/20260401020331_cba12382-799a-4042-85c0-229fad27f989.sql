
-- telegram_bot_state: only service_role
CREATE POLICY "Service manages bot state" ON public.telegram_bot_state
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- telegram_messages: only service_role
CREATE POLICY "Service manages messages" ON public.telegram_messages
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
