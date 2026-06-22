ALTER TABLE public.study_entries
  DROP CONSTRAINT IF EXISTS study_entries_kind_check;

ALTER TABLE public.study_entries
  ADD CONSTRAINT study_entries_kind_check
  CHECK (kind IN ('event', 'knowledge', 'note'));

-- Preserve the former single topic annotation as the first rich note.
INSERT INTO public.study_entries (
  user_id,
  topic_id,
  kind,
  title,
  summary,
  content,
  tags,
  entry_date
)
SELECT
  topic.user_id,
  topic.id,
  'note',
  'Anotações importadas',
  LEFT(topic.notes, 240),
  topic.notes,
  ARRAY[]::TEXT[],
  NULL
FROM public.study_topics AS topic
WHERE NULLIF(BTRIM(topic.notes), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.study_entries AS entry
    WHERE entry.topic_id = topic.id
      AND entry.kind = 'note'
      AND entry.title = 'Anotações importadas'
  );
