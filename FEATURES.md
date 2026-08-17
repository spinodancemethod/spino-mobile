# Features

## Cleanup

- Removed the deprecated On Deck UI, client code, and fresh-bootstrap schema. Added an explicit migration to remove the persisted table, RPC, sequence, RLS policies, and grants from existing databases; apply it only after confirming the old data is no longer needed.
- Removed the admin catalog upload flow and legacy catalog system: routes, video/position/favourite/note hooks, old completion state, catalog models, bootstrap tables and policies, and obsolete seed/test files. Added `20260816_remove_legacy_catalog.sql`; it removes the old database objects but does not delete storage objects automatically.

## Dance Memory MVP

- Refocused capture/edit flows so videos are treated as source-reference IDs while segment metadata (title, description, thumbnail, range) is the primary authored content.
- Wired the segment editor UI so users can create and update learning-item title, description, and thumbnail override metadata across Add Video, Local Videos, and roadmap detail flows.
- Upgraded roadmap segments into customizable learning items with per-segment title, description, and thumbnail metadata (with video-level thumbnail fallback).
- Added a local-video Phase 1 test screen with Supabase metadata, Expo media-library video selection, availability states, replacement/removal actions, and timestamp-player groundwork. Source videos are not uploaded.
- Added the Phase 1 `video_uploads` metadata migration and authenticated upsert path. Local references remain usable when Supabase sync is unavailable; source videos are never uploaded.
- Added categorized timestamp segments with mandatory `Misc` fallback, custom categories, segment validation, ownership RLS, and local-video review controls.
- Updated explicit video-reference removal to delete the authenticated cloud metadata and cascaded segments while leaving the source video on the device.
- Made Supabase the authoritative store for video metadata, categories, and segments; local media URIs remain runtime-only for device playback.
- Added an Add Video dashboard tab before Your Roadmap for naming and saving local video references without uploading source files.
- Reworked the Dance Memory MVP around user-owned roadmaps: added roadmap CRUD, required roadmap assignment for video references, and archived the legacy catalog/GIF tabs from MVP navigation.
- Added user-selected local video-frame thumbnails using `expo-video-thumbnails`; roadmap tiles now use the saved thumbnail reference instead of the legacy GIF or Local video fallback.
- Added user-upload video detail pages with the existing native player pattern, metadata, saved segments, and upload-specific notes.
- Changed user roadmap tiles to represent saved segments rather than whole source videos; opening a tile plays only its saved timestamp range.
- Updated Add Video so a source reference cannot be saved alone: each submission requires a segment range, category, and selected thumbnail, then creates the video and segment metadata together.
- Added a user-editable `custom_title` column on `video_uploads` with a Video Title section (edit modal) on the upload detail screen, falling back to the device filename when unset; roadmap tiles prefer the custom title too.

## Current Product (Google Play Runtime)

- Fixed successful password login in release builds to explicitly navigate from the auth route to Home after Supabase accepts the credentials.

- Standardized app form fields with a shared themed input so borders use the theme border color and placeholders use the theme placeholder color consistently.

- Split video category and segment data hooks, and extracted local-video library and roadmap view-model workflows from their route screens.

- Centralized auth route state and RevenueCat purchase, restore, and cache invalidation flows behind shared service and hook boundaries.

- Fixed media-library duration handling by converting millisecond video metadata to seconds before creating segment ranges and player previews.

- Updated the reusable segment player to display decimal seconds and preserve parent-page scrolling while retaining tap-to-play behavior.

- Corrected segment player time-bar labels to show source-video timestamps and enabled nested scrolling around embedded players in video-entry screens.

- Added a live segment video preview to Add Video so users can play the selected source range before adding it to a roadmap.

- Simplified video segment entry by hiding source metadata and showing timestamp defaults with two decimal places for precise editing.

- Updated new segment range defaults to use the full source-video duration instead of a 10-second cap when duration metadata is available.

- Added a confirmed delete action below video segment metadata so users can remove an individual segment from the roadmap without deleting the source video.

- Added segment thumbnail editing on video reference details, allowing users to choose and save a new square frame from the segment's local video range.

- Added category management to video reference details, allowing users to view a segment's category, move it to another category, or duplicate it into another category.

- Added segment range editing on video reference pages, allowing users to update a selected segment's start and end times with validation and immediate playback refresh.

- Local segment player controls were simplified by removing +/- seek buttons and limiting playback speed options to 0.5x and 1x.
- Local segment scrubber now supports live frame updates while dragging, with throttled seeking to keep scrubbing smooth.
- Local segment player now includes a scrub bar (tap or drag) for quick seeking within the active segment range.
- Local segment player now supports tap-to-play/pause without native dim overlays, plus configurable native controls, custom controls visibility, seek step size, and speed options.
- Category tiles on the user roadmap now match the taller segment tile height and can show category descriptions under the title using the same small-note text style.
- Your Roadmap segment tiles now show the user's saved note under each thumbnail, clamped to 2 lines for compact readability.
- Video reference detail now uses icon actions: a right-aligned edit icon on the Your Notes header and a right-aligned completion check icon on the segment title row.
- Updated video-reference notes UX to show saved notes as readable text and edit/add them via a modal editor instead of an inline textbox.
- Removed segment-description capture/display from segment flows and UI so long-form text now lives only in notes.
- Simplified the video reference detail page by removing metadata-heavy UI and the embedded segments list, leaving a cleaner segment-focused view with playback, completion toggle, and notes.
- Switched the roadmap settings panel from an inline drawer to a modal opened by the floating bottom-right settings button, while keeping toggle and Edit roadmap controls intact.
- Added a compact top drawer menu on the user roadmap that houses Show empty categories, Show completed, and an Edit roadmap action (opens the roadmap edit modal) to reduce persistent header clutter.
- Restored roadmap completion controls for the segment-based roadmap flow: added Show empty categories and Show completed toggles, plus segment completion toggling directly on the video-upload detail page.
- Fixed roadmap stale state after Add Video: segment create/update/delete now invalidates roadmap-segment queries so newly added items appear without manual page refresh.
- Scoped video categories to individual roadmaps at both app and DB layers (schema, RLS, queries, and mutations), eliminating cross-roadmap category sharing.
- Restored an Edit roadmap action on each roadmap tile in the roadmaps list, and replaced the single-roadmap header edit icon with a map icon that navigates back to Your Roadmaps.
- Added optional category descriptions across roadmap/category flows, including DB schema support plus create/edit inputs in Add Video, Local Videos, and category management modals.
- Added category-tile management on the user roadmap: tapping a category now opens a modal to rename or delete it, and delete flows warn that associated learning segments will be removed.
- Updated category tiles on the user roadmap to show each category title in the center column (with wrapped long names) and use category-specific fallback thumbnail labels instead of a static "Roadmap" label.
- Fixed standalone/test-build login hang by tightening auth deep-link detection to only process links with auth params/tokens and adding an 8-second timeout guard around auth-link session handling so the "Signing you in..." overlay cannot persist indefinitely.
- Updated Your Roadmap vertical row ordering to follow `positions."order"`, so roadmap position rows render in the same sequence as the positions table.
- Added `positions."order"` as a unique positive integer, backfilled existing rows from 1..N in table order, and wired position queries to sort by this column.
- Updated Your Roadmap left-lane add behavior to suppress the position-video `+` icon when a position has `has_videos = false`.
- Added `positions.has_videos` (boolean, default `true`) and set `basic on 1` / `basic on 5` to `false` via migration.
- Added centered loading spinners for pending network requests on Your Roadmap, Library, and Positions so users see clear loading feedback before content resolves.
- Added selected-filter empty states in Library and Positions that show a centered icon plus "No videos under that category." when no videos match the chosen category/level.
- Nudged the roadmap first-load viewport an extra 5% to the left for finer initial positioning of the positions lane.
- Tuned first-load roadmap centering to retrace halfway toward the previous offset, reducing over-left panning while keeping the positions column near center.
- Centered the roadmap positions column on first load so users land with the core position lane in the middle of the screen before any manual panning.
- Kept the roadmap left-lane position-video `+` visible for free-tier users even when a position currently has no available free position videos.
- Hardened RevenueCat identity sync by retrying transient identify conflict errors (`backendErrorCode 7638`) and catching startup/auth fire-and-forget sync promises to avoid uncaught warning noise.
- Hardened Expo Go compatibility on Subscribe by switching RevenueCat usage to type-only imports and package-type string checks (no runtime `react-native-purchases` import in screen module scope).
- Added a Position detail screen opened from Position List rows, showing a placeholder hero image plus `positions.name` and `positions.description` loaded by id.
- Stopped roadmap lane tiles from wrapping to a second line, so adding many videos keeps each lane growing horizontally in a single row.
- Moved the roadmap left-lane `+` action inline with position-video tiles so it renders directly before the first tile instead of in a detached far-left column.
- Flipped the roadmap position lane layout so the `+` action is on the far left and position videos render immediately to the left of the position column.
- Fixed roadmap left-lane `+` visibility by including `is_position` in the visible-videos query used for lane availability checks.
- Split roadmap rows into two lanes around the position column: left lane now shows only favourited `is_position = true` videos (with a Positions-tab `+` action when empty), and right lane shows only `is_position = false` videos.
- Duplicated the Library-style browser into a new `Positions` tab, renamed the old `Positions` list screen to `Position List`, and split video fetching by `is_position` (`Library=false`, `Positions=true`).
- Replaced the roadmap empty-position `No favourites added yet` placeholder card with a small centered `+` button that keeps the same jump-to-Library behavior.
- Extended the roadmap `+` affordance so it also appears at the end of rows that already contain selected videos, making add-more behavior consistent.
- Added `videos.is_position` (boolean) via migration and bootstrap schema, defaulting all current and future rows to `false`.
- Removed unused dashboard route files (`index` and `inprogress`) so the route group only contains the three active tabs: roadmap, library, and positions.
- Explicitly hid dashboard route-group utility screens (`index` redirect and legacy `inprogress`) from the Expo Router tab bar so only the intended three tabs are visible.
- Added `videos` dance metadata schema support for roadmap categorization: migration + bootstrap now include `dance_type` and `dance_style`, and `dance_type` is constrained to `salsa` or `bachata`.
- Added a follow-up data backfill migration that sets existing `videos` rows to `dance_type = 'bachata'` and `dance_style = 'fusion'`.
- Fixed dashboard navigation to use explicit nested Expo Router group paths for Home and roadmap redirects, preventing release-only tab duplication and invalid-element crashes when opening the workspace tabs.
- Added a post-purchase Home refresh handshake: Subscribe now routes back with a refresh flag and Home temporarily re-invalidates entitlement/subscription/account queries until paid status appears, so the Trial CTA is replaced promptly after checkout.
- Aligned SQL bootstrap schema with RevenueCat runtime by adding a table-level `subscriptions (provider, provider_subscription_id)` unique constraint, broadening billing provider checks to include `revenuecat`, removing obsolete Google purchase-token/bootstrap unique indexes, and adding a migration for existing databases.
- Expanded RevenueCat offerings error diagnostics to include SDK code/readable code/underlying message details, making credential and configuration failures directly visible from the subscribe screen.
- Removed `android.versionCode` from Expo app config and aligned release docs for EAS `appVersionSource: \"remote\"`, avoiding ignored-version warnings and local/remote version drift.
- Added RevenueCat subscribe diagnostics: when plans are empty, the screen now explains whether RevenueCat is unconfigured, no current offering exists, or the current offering has zero available packages, and it shows current/known offering ids for faster dashboard debugging.
- Updated snackbar dismissal UI to a left-aligned Ionicons close control for a cleaner look consistent with the app icon style.
- Added a global snackbar dismiss `X` action so all snackbars can be closed immediately without waiting for auto-timeout.
- Added a post-purchase success redirect from Subscribe to Home so users land in the app workspace immediately after activation.
- Wired account legal actions to open external browser links at `spinodancemethod.com/privacy-policy` and `spinodancemethod.com/terms-of-services`.
- Conditioned account-store subscription management visibility so `Manage in your app store` appears only for active subscribers.
- Simplified account subscription controls by removing `Manage subscription` and `Open Customer Center`, keeping store cancellation/management via the app-store link only.
- Removed noisy free-tier availability tracking (free_content_impression events) that only logged static counts instead of meaningful engagement signals.
- Simplified subscribe screen to direct purchase only by removing RevenueCat's optional managed paywall UI, keeping plan selection and checkout as the single UX path.
- Prevented mobile SecureStore auth persistence overflows by chunking large Supabase session payloads across secure-store keys and reassembling them on read.
- Serialized RevenueCat identity operations (`configure`/`logIn`/`logOut`) to avoid overlapping identify requests that can return 429 "another request in flight" errors.
- Fixed web auth-session persistence by using browser `localStorage` for Supabase on web, avoiding Expo SecureStore native-method runtime errors in web builds.
- Centralized hook-level user-id resolution with shared helpers that prefer auth-context ids, removing repeated `supabase.auth.getUser()` calls and aligning note/favourites/deck/completion query keys.
- Replaced high-traffic hook `any` usage with shared typed video/position models and centralized query-key factories, then migrated core video/position/favourites/deck/completion hooks to those shared types.
- Added explicit `@jest/globals` imports in toggle-mutation tests to avoid editor-only missing-global diagnostics for `describe`/`it`/`expect`.
- Migrated `useToggleVideoCompletion` to a shared ids-only toggle lifecycle helper so optimistic cache updates, rollback, and invalidation now follow the same reusable pattern as other toggle hooks.
- Added a shared optimistic toggle mutation lifecycle helper for favourites/deck updates so cache mutation, rollback, and invalidation behavior is centralized and consistent.
- Added shared typed roadmap models (position/video/modal payloads) and applied them across the extracted roadmap hook/components to reduce any-based data handling without changing runtime behavior.
- Split the Your Roadmap screen into modular units by extracting gesture handling into a dedicated hook and moving canvas rendering plus modal/actions UI into focused roadmap components.
- Reclassified expected RevenueCat Test Store purchase-failure scenarios from `billing.checkout` errors to a dedicated analytics event so failure-path testing no longer pollutes error telemetry.
- Improved app error telemetry normalization so object-shaped native/RevenueCat errors now preserve meaningful messages and attach diagnostic fields (for example error codes) instead of collapsing to "Unknown error".
- Added explicit RevenueCat UI runtime guards so Expo Go now surfaces a clear "use a development build" message instead of throwing Preview API/browser-document errors when opening paywalls or Customer Center.
- Added Expo Go-safe RevenueCat bootstrap behavior: the app now prefers `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY` in Expo Go and gracefully disables native purchases setup when unavailable instead of throwing startup errors.
- Fixed reset-password deep links to use path-based scheme URIs (`spino:///reset-password`) so Expo Router resolves the route instead of throwing unmatched `//reset-password`.
- Added environment-aware reset-password redirect generation with optional `EXPO_PUBLIC_AUTH_RESET_REDIRECT_TO` override so password reset links can be tested in Expo Go and still use app-scheme deep links in builds.
- Added password recovery funnel analytics by tracking `reset_start` when users enter the in-app reset screen and `reset_success` after a successful password update.
- Implemented a fully in-app password recovery flow: reset emails now deep-link to a new reset-password screen, recovery sessions route there automatically, and users can set a new password without using a browser.
- Added a reusable show/hide password eye toggle in shared text inputs so login and signup password fields can be revealed securely on demand.
- Hardened auth/session persistence by storing Supabase tokens in secure OS storage and added entitlement downgrade cache-guards so paid-only video data is immediately cleared for free users.
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
