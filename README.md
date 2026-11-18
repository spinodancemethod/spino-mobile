## Current features

This repository is a small Expo + React Native app (expo-router) focused on personal local-video roadmaps and practice tooling. Current implemented features:

- Local video references and roadmap segments — choose videos from the device, organize timestamped segments into personal roadmaps, and play them with local media access.
- Segment notes and completion — notes and progress are stored with local roadmap segments, not the removed legacy catalog.
- Themed UI primitives — `Components/` contains `ThemedView`, `ThemedText`, `ThemedButton`, and other active shared controls.
- Data fetching with React Query — centralized `queryClient` with hooks under `lib/hooks/` for roadmaps, local video references, categories, segments, and segment notes.
- Supabase integration — `lib/supabase.ts` configures the Supabase client for auth and DB access; session persistence is enabled for the RN client.

Quick files of interest

- Screens: `app/`, `app/(private)/(dashboard)/user-roadmap.tsx`, `app/(private)/video-upload/[id].tsx`
- Hooks: `lib/hooks/useUserRoadmaps.ts`, `lib/hooks/useVideoUploads.ts`, `lib/hooks/useVideoSegments.ts`, `lib/hooks/useVideoUploadDetails.ts`
- Supabase / SQL: `lib/supabase.ts`, `supabase/migrations/`

Developer notes

- There are two environments: **dev** (`spino-dev` Supabase project + Spino Dev RevenueCat project) for everyday work, and **prod** for store builds only. Keys are stored as EAS environment variables, not in the repo.
- To run locally, pull the dev keys with `eas env:pull --environment development`. This writes `.env.local` (gitignored), which `npm start` and `npm run android` read. See `lib/supabase.ts` for usage.
- Store builds use `eas build -p android --profile production`, which gets the prod keys from the EAS `production` environment.
- The database schema lives in `supabase/migrations/`. To build a fresh Supabase project or apply new migrations, run `supabase db push --remote=<ref>` (dev first, then prod). With Supabase CLI 3, commands without `--remote` target the local stack.
- The app uses React Query; if you change query keys, update mutation invalidations accordingly.
- Run `npm run typecheck` and `npm test` before releasing.

## Production monitoring

After deploying, monitor app health and billing:

- **Observability Guide:** See [OBSERVABILITY.md](OBSERVABILITY.md) for detailed monitoring queries and runbook (error rates, request volumes, billing events, client error logs).
- **First week after launch:**
	- Monitor RevenueCat webhook errors and unusual `billing_events` volume (see [OBSERVABILITY.md](OBSERVABILITY.md)).
  - Monitor `client_error_logs` grouped by context (targeting zero auth/billing errors).
  - Check app crash logs in Supabase console.
- **Ongoing:**
  - Review `client_error_logs` weekly for patterns.
  - Archive billing events older than 90 days (see [OBSERVABILITY.md](OBSERVABILITY.md) for SQL).

Project intent

This app helps you capture short, actionable practice notes linked to individual videos and positions so you can iterate and improve session-to-session.