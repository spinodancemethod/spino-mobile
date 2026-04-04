## Current features

This repository is a small Expo + React Native app (expo-router) focused on a video library with practice tooling. Current implemented features:

- Video library and detail pages — browse videos, view metadata and play back media. See `app/` and `app/(private)/video/[id].tsx`.
- Notes (CRUD) on videos — per-user notes stored in `public.notes` with a composite primary key `(user_id, video_id)`. UI: read-only note area and an edit modal (editable TextInput) on the video page. Hooks: `lib/hooks/useNoteByUserAndVideo.ts`, `lib/hooks/useUpsertNote.ts`.
- Favourites and deck features — per-user favourites and deck management via `lib/hooks/useFavouritesByUser.ts`, `lib/hooks/useToggleFavourite.ts`, `lib/hooks/useToggleDeck.ts`.
- Themed UI primitives — `Components/` contains `ThemedView`, `ThemedText`, `ThemedButton`, `ThemedPill`, `ThemedLike`, `ThemedStar`, etc.
- Position/category filtering — `usePositions` and `ThemedFilter` support selecting categories to drive video queries.
- Data fetching with React Query — centralized `queryClient` with hooks under `lib/hooks/` (`useVideos`, `usePositions`, `useNoteByUserAndVideo`, etc.), including optimistic updates patterns used by toggle mutations.
- Supabase integration — `lib/supabase.ts` configures the Supabase client for auth and DB access; session persistence is enabled for the RN client.
- Dev conveniences — `EXPO_PUBLIC_DEV_USER_ID` / `DEV_USER_ID` support for local testing (dev fallback for auth during development).

Quick files of interest

- Screens: `app/`, `app/(private)/video/[id].tsx` (video page)
- Hooks: `lib/hooks/useVideos.ts`, `lib/hooks/usePositions.ts`, `lib/hooks/useFavouritesByUser.ts`, `lib/hooks/useNoteByUserAndVideo.ts`, `lib/hooks/useUpsertNote.ts`
- Supabase / SQL: `lib/supabase.ts`, `sql/bootstrap/`

Developer notes

- To run locally, provide your Supabase URL and publishable key via Expo environment variables (e.g. `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). See `lib/supabase.ts` for usage.
- Copy `.env.example` and fill all required Expo public variables for your environment.
- Apply the `sql/bootstrap/` files in order on a fresh database so notes/video entitlement policies and billing telemetry tables are created consistently.
- For full schema bootstrap on a fresh Supabase project, run the files in `sql/bootstrap/` in this order:
	1. `sql/bootstrap/00_extensions.sql`
	2. `sql/bootstrap/01_tables.sql`
	3. `sql/bootstrap/02_functions.sql`
	4. `sql/bootstrap/03_indexes.sql`
	5. `sql/bootstrap/04_rls_policies_grants.sql`
	This recreates the current `public` schema tables, functions, indexes, RLS policies, and grants.
- The app uses React Query; if you change query keys, update mutation invalidations accordingly.
- Run `npm run typecheck` and `npm test` before releasing.

## Production monitoring

After deploying, monitor app health and billing:

- **Observability Guide:** See [OBSERVABILITY.md](OBSERVABILITY.md) for detailed monitoring queries and runbook (error rates, request volumes, billing events, client error logs).
- **First week after launch:**
  - Monitor `billing_events` for verification errors (target: < 5 per 10 min).
  - Monitor `client_error_logs` grouped by context (targeting zero auth/billing errors).
  - Check app crash logs in Supabase console.
- **Ongoing:**
  - Review `client_error_logs` weekly for patterns.
  - Archive billing events older than 90 days (see [OBSERVABILITY.md](OBSERVABILITY.md) for SQL).

Project intent

This app helps you capture short, actionable practice notes linked to individual videos and positions so you can iterate and improve session-to-session.