## Copilot / Automated Assistant Instructions — spino-mobile

Purpose
- Short, action-oriented guidance for automated assistants editing this repo. Keep changes minimal, explicit, and easy to review.

Big picture (read these files first)
- Runtime: Expo + React Native (TypeScript). Main app code: `app/` and feature screens under `app/(dashboard)/`.
- Theming: `constants/ThemeProvider.tsx` + `constants/useTheme.ts` + `constants/Colors.tsx`. UI primitives (`ThemedText`, `ThemedView`) read theme via `useTheme()` — prefer them over raw Views/Text for color correctness.
- Data layer: React Query hooks live in `lib/hooks/` (notably `useVideos`, `usePositions`, `useFavouritesByUser`, `useToggleFavourite`). Supabase client config: `lib/supabase.ts` and `lib/api/`.

What to change and what to avoid
- Small, scoped edits only. If you must refactor, open a PR with a short design note.
- Do not add new dependencies without explicit owner approval. If needed, propose which package and why.
- Never hardcode secrets. Use existing environment conventions: `EXPO_PUBLIC_DEV_USER_ID` (Expo) or `DEV_USER_ID` for local dev fallbacks.

Patterns & conventions (examples)
- Themed styling: use `useTheme()` to get `{ mode, colors }` and apply `colors.card`, `colors.text`, etc. Example: `app/your-roadmap.tsx` modal uses `colors.card` in dark mode.
- Data fetching: create small hooks under `lib/hooks/` and use React Query for caching/invalidation. Check `lib/queryClient.ts` for setup.
- Optimistic updates: `useToggleFavourite` performs optimistic updates to the favourites cache — preserve this pattern when modifying favourites logic.
- UI/gesture code: animated canvas uses React Native `Animated` + `PanResponder` (see `app/your-roadmap.tsx`) — keep gesture handling touch-friendly (don't intercept taps unnecessarily).

Critical files to inspect when editing
- `app/your-roadmap.tsx` — complex canvas, gesture, and layout math (node positioning, stems, scale/pan). Small UI changes here affect layout math.
- `lib/hooks/*.ts` — where data contracts and query keys live; keep query keys stable.
- `lib/supabase.ts` and `sql/*.sql` — Supabase integration and server-side helpers.
- `Components/` — reusable Themed components; prefer these for consistent look-and-feel.

Dev workflows & validation
- Typecheck: `npx -y tsc --noEmit` (run after edits). Run without permission.
- Start app: `npx expo start -c` (clear cache). Test on device/emulator.
- If touching queries/hooks, run a smoke test that fetches data or mock `lib/supabase` locally.

PR guidance
- Keep PRs small. Title format: `<area>: concise description` (e.g., `your-roadmap: add video modal`).
- Include a developer note if you changed query keys or added invalidations.

If uncertain
- Read `AGENTS.md` and `README.md` for context. Ask maintainers before large UI, dependency, or data-model changes.

Last updated: auto-merged from repository context.
