## Copilot / Automated Assistant Instructions — spino-mobile

These are the active workspace instructions for automated assistants editing this repository.

## Repository shape

- Runtime: Expo + React Native with TypeScript and Expo Router.
- App routes: `app/`, with authenticated screens under `app/(private)/` and dashboard routes under `app/(private)/(dashboard)/`.
- Shared UI: themed primitives under `Components/`; theme state is provided by `constants/ThemeProvider.tsx` and `constants/useTheme.ts`.
- Data layer: all network requests use TanStack Query hooks under `lib/hooks/`; Supabase client and API helpers live under `lib/`.
- Billing: RevenueCat integration is in `lib/billing/`; the webhook handler is `supabase/functions/ingest-revenuecat-webhook/`.
- Database bootstrap and migrations are under `sql/bootstrap/` and `sql/migrations/`.

## Editing rules

- Keep changes small, scoped, and consistent with existing patterns.
- Do not add dependencies without explicit approval.
- Never hardcode secrets. Use the existing `EXPO_PUBLIC_*` environment variables and `.env.example` conventions.
- Preserve existing public APIs and query keys unless the task requires a deliberate change.
- Add a concise entry to `FEATURES.md` for each feature or meaningful product change.
- Add comments for non-obvious implementation behavior, especially around native media references, entitlement gating, and asynchronous flows.

## Preferred implementation patterns

- Put all server and Supabase calls in TanStack Query hooks under `lib/hooks/`, not directly in route components.
- Keep query keys centralized in `lib/queryKeys.ts` and update invalidations when mutation behavior changes.
- Use themed components and `useTheme()` for UI colors instead of hardcoded color values.
- Treat local videos as device references: source files stay on the device, while Supabase stores metadata and timestamped segment records.
- Keep RevenueCat identity, purchase, restore, and entitlement behavior behind the existing billing service and hooks.
- Respect ownership and entitlement checks at both the client and database/RLS boundaries.

## Important files to inspect

- `app/_layout.tsx` — providers, auth/bootstrap setup, RevenueCat initialization, and entitlement cache behavior.
- `app/(private)/AppContent.tsx` — authenticated app shell and navigation composition.
- `app/(private)/(dashboard)/` — roadmap and local-video workflows.
- `app/(private)/video-upload/[id].tsx` — local video reference detail and playback.
- `lib/hooks/` — TanStack Query data contracts, mutations, and cache invalidation.
- `lib/billing/revenuecat.ts` — RevenueCat SDK boundary and entitlement checks.
- `lib/supabase.ts` — Supabase client configuration and session persistence.
- `Components/` — reusable themed controls and media components.
- `sql/bootstrap/` — fresh-database schema, functions, indexes, and RLS grants.

## Validation

- Run `npm run typecheck` after TypeScript changes.
- Run the narrowest relevant Jest test, then `npm test` for shared behavior changes.
- For query or billing changes, verify query keys, invalidations, ownership, and error states.
- For route or native-media changes, test the affected flow on the appropriate Expo development build.
- Do not commit changes unless explicitly requested.

## Documentation roles

- `README.md` is the human setup and product workflow entry point.
- `AGENTS.md` contains repository-wide conventions shared by automated agents.
- `CLAUDE.md` contains Claude Code-specific commands and architecture context.
- `READMEPLAYSTORE.md` contains the mobile release checklist.
- `OBSERVABILITY.md` contains the production monitoring runbook.

When uncertain, inspect the nearest owning abstraction and a neighboring test or call site before expanding scope.
