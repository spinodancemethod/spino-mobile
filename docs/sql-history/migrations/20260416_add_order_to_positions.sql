-- Add explicit ordering column to positions.
-- Existing rows are backfilled in current physical table order.

BEGIN;

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS "order" integer;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY ctid) AS rn
  FROM public.positions
)
UPDATE public.positions p
SET "order" = ranked.rn
FROM ranked
WHERE p.id = ranked.id;

CREATE SEQUENCE IF NOT EXISTS public.positions_order_seq;

SELECT setval(
  'public.positions_order_seq',
  COALESCE((SELECT MAX("order") FROM public.positions), 0),
  true
);

ALTER TABLE public.positions
  ALTER COLUMN "order" SET NOT NULL;

ALTER TABLE public.positions
  ALTER COLUMN "order" SET DEFAULT nextval('public.positions_order_seq');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'positions_order_unique'
  ) THEN
    ALTER TABLE public.positions
      ADD CONSTRAINT positions_order_unique UNIQUE ("order");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'positions_order_positive'
  ) THEN
    ALTER TABLE public.positions
      ADD CONSTRAINT positions_order_positive CHECK ("order" > 0);
  END IF;
END $$;

COMMIT;
