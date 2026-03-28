# Features

## Current Product (Google Play Runtime)

- Updated transitive production dependencies via `npm audit fix --omit=dev` to clear high-severity audit findings; only one moderate advisory remains (`brace-expansion`).
- Removed unused `app/(private)/subscribe/success.tsx` and `app/(private)/subscribe/cancel.tsx` screens left from the old web checkout return flow.
- Sanitized client-facing Google verification errors in `verify-google-play-purchase` so upstream response details are not leaked.
- Replaced `@ts-ignore` auth link and OAuth calls with typed-safe Supabase API usage in `lib/auth.tsx`.
- Made `subscriptions.stripe_subscription_id` nullable for non-Stripe providers (Google Play) across bootstrap schema and production migration (`sql/migrations/20260328_make_stripe_subscription_id_nullable.sql`).

- Removed account-age-based auto logout so sessions are no longer invalidated after 24 hours from signup date.
- Updated Google Play purchase flow to finalize transactions only after server-side verification succeeds, reducing entitlement drift risk.
- Added restore-purchase request throttling to align with verify endpoint rate limits and avoid 429 loops.
- Replaced placeholder legal links with environment-driven URLs (`EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL`) and user-safe fallback messaging.
- Added dynamic Expo updates URL injection via `app.config.ts` using `EXPO_PUBLIC_EAS_PROJECT_ID`/`EAS_PROJECT_ID`, removing hardcoded `YOUR_PROJECT_ID`.
- Added an Android release smoke CI job for tags/manual runs that prebuilds and bundles with temporary debug signing.
- Cleaned `.env.example` and added missing production env keys for legal URLs and EAS project ID.

- Switched deck toggling to the server-side `toggle_deck_with_subscription_limit` RPC so advisory locking and limit checks are atomic under concurrent taps/devices.
- Switched release guidance back to generated Android mode: `/android` is ignored again and Play Store docs now describe local regeneration (`expo prebuild`) instead of tracking native files in git.
- Cleaned production docs to match `sql/bootstrap`, removed stale client-side deck-limit prechecks in favor of server-enforced limits, and tightened bootstrap grants by dropping broad `anon` privileges.
- Merged Play Store and subscription docs into a single phased release guide in `READMEPLAYSTORE.md` and kept `READMESUBSCRIBE.md` as a compatibility pointer.
- Added an ordered `sql/bootstrap/` schema bundle (extensions, tables, functions, indexes, RLS/policies/grants) so a fresh Supabase project can be initialized from the repo quickly.
- Expanded automated coverage with tests for auth URL handling, entitlement guard decisions, Google verification response mapping, and deck/favourite toggle cache behavior.
- Added centralized app-side error logging (`lib/observability.ts` + `sql/client_error_logs.sql`) and an operations runbook (`OBSERVABILITY.md`) with edge-function alert thresholds.
- Added a direct video-route entitlement guard so non-subscribed users are redirected to `/subscribe` even when bypassing dashboard tabs.
- Added strict package-name allowlist validation and per-user verification request throttling in `verify-google-play-purchase`.
- Added `sql/videos_subscription_rls.sql` to enforce subscription-based video reads at the database policy layer.
- Added a dashboard entitlement gate that checks `has_active_subscription` before allowing paid tab access.
- Hardened Google Play verification by validating missing env keys explicitly, sanitizing upstream error output, and making billing event IDs deterministic per purchase/order.
- Fixed deck pre-check cache key usage to read user-specific deck cache entries instead of a stale `current` key.
- Added a shared subscription access utility with baseline Jest tests, plus project scripts for `typecheck` and `test`.
- Added `.env.example` and `PRODUCTION_READINESS.md` to improve onboarding and release execution consistency.
- Added the roadmap screen as a dedicated dashboard tab between On Deck and Library.
- Grouped the home subscription status text and workspace CTA into a single conditional subscription tile for clearer paid-state UX.
- Switched favourite action icons from heart/heart-outline to map/map-outline across shared UI components and dashboard tab config.
- Updated roadmap rendering to include only favourited videos, grouped by position, so users can build a custom roadmap from saved content.
- Added a roadmap toggle to show empty positions and display a "No favourites yet" marker so users can spot skill gaps.
- Reworked the roadmap layout into vertical position rows with each position's chosen videos displayed beside it for easier gap scanning.
- Set the roadmap to open slightly zoomed out from its top-left origin so the Positions header is immediately visible on entry.
- Stabilized roadmap canvas height across the empty-position toggle so the chart no longer jumps vertically when the filter changes.
- Nudged the roadmap's initial vertical viewport upward so the positions tile starts higher on screen without changing toggle/zoom behavior.
- Added a conditional Subscribe CTA on Home for non-subscribed users that routes to a dedicated subscription flow.
- Added a new private subscription purchase/cart page with plan selection and checkout placeholder UI.
- Replaced Home's hardcoded subscription flag with the shared subscription status hook and added a loading-state card to avoid showing the wrong CTA while entitlement is being fetched.
- Replaced the burger-menu Profile entry with a new Account page backed by TanStack Query (`useAccountDetails`) that shows user account details and current subscription status.
- Simplified the Account page subscription summary by removing sensitive internal identifiers.
- Aligned Android release identity for production by setting the app package/namespace to `com.spino.mobile` and updating display branding to `Spino`.
- Hardened Android release signing configuration with `SPINO_UPLOAD_*` keystore properties and a release-build guard that blocks accidental unsigned/debug release submissions.
- Updated Android manifest for Play readiness by removing risky legacy storage/overlay permissions and aligning app deep-link scheme to `spino`.
- Added `READMEPLAYSTORE.md` with a detailed launch-prep plan for repo app setup decisions and Android native project strategy before Play Store submission.
- Drafted Google Play Billing migration assets around provider-agnostic subscription fields and the `verify-google-play-purchase` edge function for server-side purchase verification and entitlement upsert.

## Archived Stripe-Era Milestones

- Stripe checkout/webhook/cancel runtime paths were removed and billing was migrated to Google Play verification flows.
- The deprecated Supabase `create-checkout-session` Stripe edge function was removed as part of the Google Play-only runtime cutover.
