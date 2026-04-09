# Features

## Current Product (Google Play Runtime)

- Added RevenueCat paywall presentation on the subscribe screen and Customer Center entry in account management, with explicit Pro entitlement-id validation instead of generic entitlement checks.
- Replaced the subscribe screen's hardcoded Google Play purchase path with RevenueCat offerings and purchase APIs, while keeping existing subscription/account refresh behavior.
- Switched the account screen restore flow to RevenueCat and replaced Google Play-specific subscription management copy with app-store-neutral wording.
- Added a RevenueCat cutover SQL migration that widens billing provider checks and removes the Google Play-only purchase-token index.
- Added a RevenueCat webhook ingestion edge function that validates authorization, stores idempotent billing events, and maps RevenueCat lifecycle events into subscription rows.
- Replaced the obsolete Google verification test helper with shared RevenueCat webhook mapping tests that cover lifecycle status decisions and user-id resolution.
- Rewrote the Play Store release guide's billing section and pre-release checklist to document RevenueCat app keys, offerings, and webhook setup instead of the deleted Google verification function.
- Trimmed this file into a release-focused artifact and moved legacy detail into a compact archive section.
- Removed Stripe-only bootstrap schema artifacts (`billing_customers`, `stripe_webhook_events`, Stripe-specific indexes/rls checks) so fresh bootstrap scripts match the Google Play-only runtime.
- Replaced remaining weak typing in `Components/ThemedPill.tsx` with typed theme-token narrowing and removed dynamic `any` casts.
- Cleared high-severity production dependency audit findings via `npm audit fix --omit=dev` (one moderate advisory remains).
- Hardened Google Play runtime paths: verification error sanitization, finalize-after-verify purchase flow, and restore throttling.
- Simplified release operations with dynamic Expo updates URL injection, legal URL env wiring, and Android release smoke CI.
- Maintained production access controls via subscription-backed entitlement guards in app UI and SQL bootstrap policies.
- Removed Google/Apple OAuth options from the login screen so authentication is now email/password only.
- Increased the vertical spacing between the login title and welcome-back helper text for clearer visual hierarchy.
- Increased the vertical spacing between the Create account title and sign-up helper text on the registration page.
- Removed Google/Apple OAuth options from the registration screen so account creation is now email/password only.
- Increased container horizontal padding on login, sign-up, and forgot-password pages to improve auth form spacing and balance.
- Increased spacing between the Reset password heading and helper text on the forgot-password screen.
- Added a service-role-only RLS policy on billing events to remove no-policy exposure while keeping client access blocked.
- Aligned test tooling with Expo 54 by pinning `jest` to `~29.7.0` and `@types/jest` to `29.5.14`.
- Fixed Android EAS build Kotlin metadata mismatches by upgrading `expo-dev-client` to the Expo SDK 54-compatible line and aligning the Android Kotlin override to `2.1.20`.
- Fixed Android release compilation against React Native 0.81 by upgrading `react-native-purchases` and `react-native-purchases-ui` to `9.15.2`.
- Resolved Expo doctor compatibility checks by explicitly merging `app.json` values inside `app.config.ts` and adding the `expo-font` plugin/dependency.
- Prevented NitroModules startup crashes by lazily importing `react-native-iap` inside Android purchase/restore/finalize flows instead of module-level imports.
- Improved roadmap pinch-to-zoom behavior by anchoring zoom around the pinch midpoint for more natural gesture tracking.
- Fixed roadmap pinch drift by making pinch gestures scale-only and applying scale before translation transforms.
- Refined roadmap pinch focal compensation so zoom keeps the roadmap centered instead of panning upward while scaling.
- Stabilized roadmap pinch transitions by anchoring zoom in screen coordinates and re-seeding pinch state when a second finger is added mid-gesture.
- Expanded roadmap video tiles to include a title + GIF preview area, with zoom-threshold GIF activation and CDN-backed sample media wiring.
- Switched roadmap GIF tiles to `expo-image` rendering for reliable animated playback on Android when zoom threshold is crossed.
- Updated roadmap video nodes to use static placeholder previews and show the animated GIF inside the video-detail modal with a dedicated Go to video action.
- Added static placeholder preview images for position nodes with a backend-ready `roadmap_preview_url` fallback path.
- Restyled position nodes to mirror video tile composition with top-aligned titles and matched tile height for consistent roadmap rhythm.
- Fixed web runtime compatibility by adding a Google Play finalize stub export in the `.web` hook so web bundles avoid loading Nitro-based native IAP modules.
- Added a `user_video_progress` SQL migration plus bootstrap/RLS updates so per-user roadmap completion can be stored independently for each video.
- Wired roadmap completion badges to Supabase-backed per-user progress rows and made the badge toggle insert/delete completion records directly from the roadmap view.
- Replaced named video level pills (Beginner/Improver/etc.) with numeric levels 1-5 and mapped pill colors progressively from green (1) to red (5).
- Added a centered plus-circle CTA to empty roadmap position cards (when "Show empty positions" is on) that opens Library with that position preselected in the filter.
- Added a "Hide completed" toggle on Your Roadmap that filters out videos the user has already marked complete.
- Increased vertical spacing between video tiles in Library so each item has clearer visual separation.
- Deprecated On Deck in UI by hiding the dashboard tab entry and suppressing add-to-deck star toggles while leaving underlying deck code in place.
- Set the dashboard tabs to open on Your Roadmap by default instead of In Progress.
- Added an explicit dashboard root redirect to Your Roadmap and updated the home workspace CTA to open roadmap instead of In Progress.
- Raised the roadmap's initial viewport offset so the Positions header appears higher on first load.
- Hid the dashboard redirect-only `index` route from the tab bar so no `index` tile is shown.
- Auto-enables `Show empty positions` when a user has no roadmap videos so the roadmap never opens to a blank view.
- Fixed roadmap empty-position plus navigation so Library reliably auto-selects the tapped position, including when the Library tab is already mounted.
- Added free-tier roadmap population via a dedicated `access_tier = 'free'` query and rendered grey locked premium placeholders that route free users to Subscribe.
- Added free-tier entitlement test coverage: mocked `useEntitlement` hook behavior, SQL `can_access_video` logic mirror tests, and expanded entitlement guard assertions.
- Added a structured free tier experience: free users can browse starter free videos, paid content presents locked upsell states, and analytics now log free content impressions, locked-content taps, and subscribe CTA presses from locked screens.
- Added observability analytics unit coverage for `reportAppEvent`, including successful event inserts, missing-user short-circuit behavior, and failure-safe non-throwing inserts.
- Normalized authenticated app entry to Home and added a workspace quick-link below the Home subscribe card so free users can open the dashboard without subscribing first.
- Promoted the Home free-tier `Go to Workspace` quick-link to a visually prominent primary CTA with an icon so it stands out from surrounding content.
- Added tier-aware access control for positions, including `positions.access_tier`, a `can_access_position` helper, and position-aware video access so free/premium positions can be selectively published later.
- Updated roadmap tile logic so positions with visible videos but no roadmap items now show the plus tile to jump to Library, while truly unavailable positions keep a subscribe-lock tile.
- Simplified roadmap position filtering to show only positions with actual roadmap videos, excluding empty and paywalled-only positions, and removed the confusing Show Empty Positions toggle.

## Archived Stripe-Era Milestones

- Stripe checkout/webhook/cancel runtime paths were removed and billing was migrated to Google Play verification flows.
- The deprecated Supabase `create-checkout-session` Stripe edge function was removed as part of the Google Play-only runtime cutover.
