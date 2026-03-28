# Features

## Current Product (Google Play Runtime)

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

## Archived Stripe-Era Milestones

- Stripe checkout/webhook/cancel runtime paths were removed and billing was migrated to Google Play verification flows.
- The deprecated Supabase `create-checkout-session` Stripe edge function was removed as part of the Google Play-only runtime cutover.
