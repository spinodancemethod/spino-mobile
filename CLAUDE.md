# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start Expo dev server
npm run android    # Run on Android device/emulator
npm run ios        # Run on iOS simulator
npm test           # Run Jest tests (--runInBand, sequential)
npm run typecheck  # TypeScript type check (no emit)
```

Run a single test file:
```bash
npx jest lib/subscriptionAccess.test.ts --runInBand
```

## Environment

Copy `.env.example` and fill in:
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase backend
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` — in-app purchases
- `EXPO_PUBLIC_DEV_USER_ID` — dev-only auth bypass for local testing

## Architecture

**Expo Router (file-based routing)**
- `app/_layout.tsx` — root layout: wraps the app in `QueryClientProvider`, `ThemeProvider`, `AuthProvider`, `ErrorBoundary`, `GestureHandlerRootView`, and `Snackbar`. Also mounts `RevenueCatBootstrap` (initializes RevenueCat SDK and syncs entitlement cache on login) and `EntitlementCacheGuard` (flushes video cache on paid→free transition).
- `app/(auth)/` — unauthenticated screens (login, signup, password reset)
- `app/(private)/_layout.tsx` — auth gate: redirects to `/login` if no user, email verification gate, then renders `AppContent`
- `app/(private)/(dashboard)/` — main tab navigation (library, positions, roadmap, etc.)
- `app/(private)/video/[id].tsx` — video detail/player page
- `app/(private)/position/[id].tsx` — position detail page

**Data layer**
- `lib/supabase.ts` — Supabase client with chunked SecureStore session persistence (handles iOS SecureStore 2KB limit by splitting large tokens into chunks)
- `lib/auth.tsx` — `AuthProvider` / `useAuth` hook (Supabase auth session state)
- `lib/hooks/` — all React Query hooks. All network requests go here, not inline in components
- `lib/queryKeys.ts` — centralized query key definitions; keep in sync with `queryClient.invalidateQueries` calls when mutating
- `lib/queryClient.ts` — shared `QueryClient` instance
- `lib/models.ts` — shared TypeScript types (`VideoRecord`, `PositionRecord`, `CreateVideoPayload`, etc.)

**Billing / entitlements**
- `lib/billing/revenuecat.ts` — RevenueCat SDK wrapper (iOS + Android in-app purchases)
- `lib/billing/revenuecatWebhookMapping.ts` — maps RevenueCat webhook events to internal subscription states
- `supabase/functions/ingest-revenuecat-webhook/` — Edge Function that receives RevenueCat webhooks and updates `billing_events` + subscription records
- `lib/hooks/useEntitlement.ts` — primary hook for access control; drives paywall redirect logic
- `lib/hooks/useSubscriptionStatus.ts` — raw subscription status (active/trialing/grace_period)
- `lib/subscriptionAccess.ts` — pure function `hasActiveSubscription()` (status + expiry logic)
- `lib/entitlementGuards.ts` — pure helpers used by screens to decide redirect vs pending state

**UI components**
- `Components/` — themed primitives (`ThemedView`, `ThemedText`, `ThemedButton`, `ThemedPill`, `ThemedLike`, `ThemedStar`, `ThemedFilter`, `ThemedSearch`)
- `constants/ThemeProvider.tsx` + `constants/useTheme.ts` — light/dark theme context
- `Components/CustomVideoPlayer.tsx` — video player component
- `Components/Snackbar.tsx` + `lib/snackbarService.ts` — global imperative snackbar (`showSnack(message)`)

**Database**
- Bootstrap a fresh Supabase project by running `sql/bootstrap/` files in order: `00_extensions` → `01_tables` → `02_functions` → `03_indexes` → `04_rls_policies_grants`
- RLS is enforced on all user data; entitlement-gated content is restricted at the DB level

## Conventions

- All network requests use TanStack Query and live in `lib/hooks/`
- Add a brief entry to `FEATURES.md` for each feature added
- Include code comments to explain non-obvious behavior (can be removed later)
- `DECK_LIMIT = 3` (see `constants/Config.ts`) — hard cap on deck items per user
- Run `npm run typecheck && npm test` before releasing
