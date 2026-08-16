## Current features

This repository is a small Expo + React Native app (expo-router) focused on personal local-video roadmaps and practice tooling. Current implemented features:

- Local video references and roadmap segments — choose videos from the device, organize timestamped segments into personal roadmaps, and play them with local media access.
- Segment notes and completion — notes and progress are stored with local roadmap segments, not the removed legacy catalog.
- Themed UI primitives — `Components/` contains `ThemedView`, `ThemedText`, `ThemedButton`, and other active shared controls.
- Data fetching with React Query — centralized `queryClient` with hooks under `lib/hooks/` for roadmaps, local video references, categories, segments, and segment notes.
- Supabase integration — `lib/supabase.ts` configures the Supabase client for auth and DB access; session persistence is enabled for the RN client.
- Dev conveniences — `EXPO_PUBLIC_DEV_USER_ID` / `DEV_USER_ID` support for local testing (dev fallback for auth during development).

Quick files of interest

- Screens: `app/`, `app/(private)/(dashboard)/user-roadmap.tsx`, `app/(private)/video-upload/[id].tsx`
- Hooks: `lib/hooks/useUserRoadmaps.ts`, `lib/hooks/useVideoUploads.ts`, `lib/hooks/useVideoSegments.ts`, `lib/hooks/useVideoUploadDetails.ts`
- Supabase / SQL: `lib/supabase.ts`, `sql/bootstrap/`

Developer notes

- To run locally, provide your Supabase URL and publishable key via Expo environment variables (e.g. `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). See `lib/supabase.ts` for usage.
- Copy `.env.example` and fill all required Expo public variables for your environment.
- Apply the `sql/bootstrap/` files in order on a fresh database so roadmap, segment, and billing telemetry tables are created consistently.
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