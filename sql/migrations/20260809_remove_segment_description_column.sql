-- Consolidate long-form segment text into notes and remove duplicate description column.

BEGIN;

UPDATE public.segments
SET user_notes = NULLIF(trim(description), '')
WHERE description IS NOT NULL
  AND trim(description) <> ''
  AND (user_notes IS NULL OR trim(user_notes) = '');

ALTER TABLE public.segments
  DROP COLUMN IF EXISTS description;

COMMIT;
