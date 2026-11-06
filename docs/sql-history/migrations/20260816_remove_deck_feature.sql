-- Remove the deprecated On Deck feature and its persisted data.
-- Apply only after confirming that any remaining deck data is no longer needed.

BEGIN;

DROP FUNCTION IF EXISTS public.toggle_deck_with_subscription_limit(uuid, uuid);
DROP TABLE IF EXISTS public.deck;
DROP SEQUENCE IF EXISTS public.deck_id_seq;

COMMIT;
