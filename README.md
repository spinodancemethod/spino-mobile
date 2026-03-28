## Current features

This repository is a small Expo + React Native app (expo-router) focused on a video library with practice tooling. Current implemented features:

- Video library and detail pages — browse videos, view metadata and play back media. See `app/` and `app/(private)/video/[id].tsx`.
- Notes (CRUD) on videos — per-user notes stored in `public.notes` with a composite primary key `(user_id, video_id)`. UI: read-only note area and an edit modal (editable TextInput) on the video page. Hooks: `lib/hooks/useNoteByUserAndVideo.ts`, `lib/hooks/useUpsertNote.ts`. Server: `sql/notes_rls_policies.sql` contains recommended RLS policies.
- Favourites and deck features — per-user favourites and deck management via `lib/hooks/useFavouritesByUser.ts`, `lib/hooks/useToggleFavourite.ts`, `lib/hooks/useToggleDeck.ts`.
- Themed UI primitives — `Components/` contains `ThemedView`, `ThemedText`, `ThemedButton`, `ThemedPill`, `ThemedLike`, `ThemedStar`, etc.
- Position/category filtering — `usePositions` and `ThemedFilter` support selecting categories to drive video queries.
- Data fetching with React Query — centralized `queryClient` with hooks under `lib/hooks/` (`useVideos`, `usePositions`, `useNoteByUserAndVideo`, etc.), including optimistic updates patterns used by toggle mutations.
- Supabase integration — `lib/supabase.ts` configures the Supabase client for auth and DB access; session persistence is enabled for the RN client.
- Dev conveniences — `EXPO_PUBLIC_DEV_USER_ID` / `DEV_USER_ID` support for local testing (dev fallback for auth during development).

Quick files of interest

- Screens: `app/`, `app/(private)/video/[id].tsx` (video page)
- Hooks: `lib/hooks/useVideos.ts`, `lib/hooks/usePositions.ts`, `lib/hooks/useFavouritesByUser.ts`, `lib/hooks/useNoteByUserAndVideo.ts`, `lib/hooks/useUpsertNote.ts`
- Supabase / SQL: `lib/supabase.ts`, `sql/notes_rls_policies.sql`, `sql/get_videos_with_fav.sql`

Developer notes

- To run locally, provide your Supabase URL and publishable key via Expo environment variables (e.g. `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). See `lib/supabase.ts` for usage.
- Copy `.env.example` and fill all required Expo public variables for your environment.
- The `notes` table uses row-level security; apply `sql/notes_rls_policies.sql` in the Supabase SQL editor (as an admin) so authenticated clients can access their own rows.
- The app uses React Query; if you change query keys, update mutation invalidations accordingly.
- Run `npm run typecheck` and `npm test` before releasing.

Short TODOs

- Redo the roadmap. the roadmap should reflect the users repertoire of moves that they have mastered for easy reviewing. This will require an additional table maybe called mastered which has user_id and video_id

Project intent

This app helps you capture short, actionable practice notes linked to individual videos and positions so you can iterate and improve session-to-session.