## Current features

This repository contains a small Expo + React Native app (expo-router) with the following implemented features:

- Library list (single-column) — `app/(dashboard)/library.tsx` displays videos filtered by position/category.
- Themed UI primitives — reusable components in `Components/` such as `ThemedView`, `ThemedText`, `ThemedButton`, `ThemedPill`, `ThemedLike`, `ThemedStar`.
- Position/category selector — `usePositions` hook and `ThemedFilter` component to pick a category that drives the videos query.
- Data fetching with React Query — centralized `queryClient` and hooks under `lib/hooks/` (`useVideos`, `usePositions`, `useFavouritesByUser`).
- Conditional fetching — `useVideos` only requests videos when a position/category is selected to avoid unnecessary network calls.
- Favourites support (client) —
	- `useFavouritesByUser` returns favourite `video_id`s for the current (or dev) user.
	- `useToggleFavourite` mutation performs optimistic updates: it flips the local favourites cache immediately and inserts/deletes rows in the `favourites` table.
- Supabase integration — `lib/supabase.ts` configures the Supabase client for auth and database access.
- Dev conveniences:
	- `EXPO_PUBLIC_DEV_USER_ID` / `DEV_USER_ID` support and a small development fallback so you can test favourites without a full auth flow.
	- A SQL file `sql/get_videos_with_fav.sql` with an example RPC (Postgres function) that can return videos with an `is_favourite` boolean server-side (optional to deploy).

Quick files of interest

- Screens: `app/` and `app/(dashboard)/`
- Hooks: `lib/hooks/useVideos.ts`, `lib/hooks/usePositions.ts`, `lib/hooks/useFavouritesByUser.ts`, `lib/hooks/useToggleFavourite.ts`
- API helpers / SQL: `lib/api/` and `sql/get_videos_with_fav.sql`

Dev notes

- To test favourites without signing in, set `EXPO_PUBLIC_DEV_USER_ID` in your Expo config (`app.json` extras) or set `DEV_USER_ID` in your environment and restart Expo. The app contains a temporary dev fallback for quicker local testing — remove it before production.
- To enable the server-side RPC, run the SQL in `sql/get_videos_with_fav.sql` in your Supabase project's SQL editor.
- The app uses React Query. If you change query keys, update any mutation invalidations accordingly.

If you want a condensed list of remaining TODOs or prefer I add documentation for running locally (env, Expo, Supabase vars), tell me which area to document and I'll add it.

---

TODO (previous notes)

- Connect up a video page to the library - Include Notes section and comments for private viewing, CRUD style.
- Seed video files.
- Add like functionality to store to favourites.
- Add the functionality to add/remove from deck.
- Wire up the filter logic for the categories.
- Create coloured pills for each video category.
- Page to explain positions.
- Make users able to set a video as complete.
- We will need levels for each class maybe 1-5 remember this is a beginners app only, not really interested in advanced dancers. 
