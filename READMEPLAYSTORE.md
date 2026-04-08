# Play Store + Subscription Release Guide

This document combines Play Store preparation and subscription rollout into one practical, ordered guide for this repository.

## Scope

Use this guide when preparing a mobile release that includes paid digital access via RevenueCat-managed subscriptions and Supabase entitlement checks.

## Current baseline in this repo

- App name: `Spino`
- Expo slug: `spino-mobile`
- Android package: `com.spino.mobile`
- Deep-link scheme: `spino`
- Billing path: RevenueCat SDK purchases + RevenueCat webhook ingestion into Supabase

Primary files involved:

- `app.json`
- `supabase/functions/ingest-revenuecat-webhook/index.ts`
- `sql/bootstrap/`

`android/` can be generated locally when needed (for example with `npx expo prebuild --platform android`) and does not need to be tracked in git.

## Phase 1: App identity and release config

### 1.1 Identity checklist

- [ ] `expo.name` matches Android display name.
- [ ] `expo.android.package` matches Gradle `applicationId` and `namespace`.
- [ ] `expo.scheme` matches Android intent-filter scheme.
- [ ] Version values are set intentionally for the next upload.

### 1.2 Versioning rule

- [ ] `versionName` follows semantic labels (`1.0.0`, `1.0.1`, `1.1.0`).
- [ ] `versionCode` increases by 1 on every Play upload.
- [ ] No previously used `versionCode` is reused.

### 1.3 Permissions and assets

- [ ] Android permissions are minimal and justified.
- [ ] App icon and adaptive icon are final enough for testing.
- [ ] Splash and branding assets are ready.
- [ ] Play listing assets (screenshots and feature graphic) are prepared.

## Phase 2: Native Android project strategy

### 2.1 Choose one strategy

Option A: Generated native project

- `android/` is not tracked.
- Native state is regenerated from Expo config/plugins.

Option B: Tracked native project

- `android/` is committed.
- Native Gradle/manifest/resource edits are versioned.

### 2.2 Recommended for this repo now

For this repo, use generated native Android mode.

- [ ] Keep `/android` ignored in `.gitignore`.
- [ ] Regenerate native Android locally only when needed (`npx expo prebuild --platform android`).
- [ ] Keep signing secrets outside git.

### 2.3 Commit and secret boundaries

Commit:

- `app.json`
- Expo config/plugin source files that define native behavior
- scripts/docs used to regenerate native files consistently

Do not commit:

- generated `android/` folder
- `.jks` keystore files
- passwords
- secret env files

## Phase 3: RevenueCat subscription setup

### 3.1 Product setup

- [ ] Create products in App Store Connect and Google Play Console.
- [ ] Add both store products to RevenueCat and map them to the same entitlement.
- [ ] Create an offering in RevenueCat that contains the monthly and yearly packages used by the app.

Required app env:

- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_TERMS_URL`
- `EXPO_PUBLIC_EAS_PROJECT_ID` (used by `app.config.ts` to inject `updates.url`)

Required function secrets:

- `REVENUECAT_WEBHOOK_AUTHORIZATION` — Shared authorization header value configured in the RevenueCat webhook dashboard and validated by the Supabase function.
- `SUPABASE_SERVICE_ROLE_KEY` — Used by the webhook function to upsert subscriptions and billing events.

RevenueCat dashboard setup:

- [ ] Connect the Google Play app in RevenueCat.
- [ ] Connect the App Store app in RevenueCat.
- [ ] Create the shared entitlement used to unlock paid content.
- [ ] Create the current offering and confirm both packages appear in it.
- [ ] Configure a webhook pointing to `supabase/functions/ingest-revenuecat-webhook`.
- [ ] Set the webhook `Authorization` header to the same value stored in `REVENUECAT_WEBHOOK_AUTHORIZATION`.

### 3.2 Purchase and verification path

- [ ] App fetches subscription offerings from RevenueCat.
- [ ] App starts purchase through the RevenueCat SDK.
- [ ] RevenueCat webhook sends lifecycle events to `ingest-revenuecat-webhook`.
- [ ] Backend upserts `subscriptions` with `provider = 'revenuecat'`.
- [ ] Access unlocks immediately after purchase and remains aligned via webhook updates.

### 3.3 Entitlement and restore behavior

- [ ] Paid screens gate on active subscription and non-expired `current_period_end`.
- [ ] Restore purchases flow calls RevenueCat restore and refreshes local entitlement state.
- [ ] Expired/canceled subscriptions lose access correctly.

## Phase 4: Content rating, builds, and release

### 4.1 Play Console setup

- [ ] Create app listing in Google Play Console.
- [ ] Complete content rating questionnaire:
  - App category: `Lifestyle` (fitness/practice content).
  - Mark all restricted content questions as `No` unless your app has mature themes.
  - Save and publish rating certificate.
- [ ] Add store listing details:
  - Screenshots (min 2, max 8; landscape or portrait).
  - Feature graphic (1024×500px mandatory).
  - Short description (80 chars).
  - Full description (4000 chars).
  - App support email (visible on store).

### 4.2 Local build and signing

Define signing properties in `~/.gradle/gradle.properties` (local only, never committed):

```
SPINO_UPLOAD_STORE_FILE=/path/to/spino.keystore
SPINO_UPLOAD_STORE_PASSWORD=your_keystore_password
SPINO_UPLOAD_KEY_ALIAS=spino
SPINO_UPLOAD_KEY_PASSWORD=your_key_password
```

Generate a new keystore (first time only):

```bash
keytool -genkey -v -keystore ~/.android/spino.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 -alias spino
```

Build Android App Bundle (AAB):

```bash
npx expo prebuild --platform android
cd android && ./gradlew bundleRelease
```

AAB output: `android/app/build/outputs/bundle/release/app-release.aab`

### 4.3 Internal testing release

- [ ] Upload AAB to Play Console > Internal Testing track.
- [ ] Invite test accounts (your own accounts or trusted testers).
- [ ] Test on physical device or emulator:
  - Auth: sign up, email confirmation, sign in, sign out.
  - Free content: browse library, add to favorites and deck, view notes.
  - Paid content: attempt access to restricted videos → redirected to subscribe.
  - Subscription: purchase through RevenueCat, verify completion, check entitlement state.
  - Restore: uninstall app, re-install, tap "Restore purchases".
  - Cancel/expiry: cancel subscription in the relevant store, check app reflects loss of access after webhook sync.
- [ ] Collect feedback and fix critical issues.

### 4.4 Promotion to production

- [ ] Complete all testing and validation.
- [ ] Run final CI checks locally: `npm run typecheck && npm test`.
- [ ] Tag git: `git tag -a v1.0.0 -m "Release 1.0.0: Initial public release"`.
- [ ] Push tag: `git push origin v1.0.0`.
- [ ] Promote internal testing build to Production track in Play Console.
- [ ] Publish to Play Store (may take 2-4 hours to go live).

## Definition of done

Release readiness is achieved when all are true:

- [ ] Android identity/version settings are consistent and intentional.
- [ ] Native Android strategy is explicit and reproducible (generated mode).
- [ ] RevenueCat subscriptions are purchasable from the app on both iOS and Android.
- [ ] RevenueCat webhook ingestion writes authoritative entitlement state in Supabase.
- [ ] Access behavior is correct on purchase, restore, expiry, and cancel.
- [ ] Internal testing build passes end-to-end validation.
- [ ] Content rating questionnaire is complete in Play Console.
- [ ] All legal and support links are live and linked in app.
- [ ] Pre-release checklist below is satisfied.

---

## Pre-release checklist

Copy and complete before tagging `v1.0.0` and submitting to Play Store:

**Environment & Configuration:**
- [ ] RevenueCat app keys are set in `.env` (`EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`).
- [ ] Supabase Edge Function secrets are set (`REVENUECAT_WEBHOOK_AUTHORIZATION`, `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] RevenueCat webhook is configured to call `ingest-revenuecat-webhook` with the expected `Authorization` header.
- [ ] Fresh database: run `sql/bootstrap/*.sql` in order on a test Supabase project without errors.
- [ ] `app.json`: `version = "1.0.0"`, `versionCode = 1`.
- [ ] `.env` NOT committed; `.env.example` is current; `git ls-files | grep -E '\\.env|secrets'` returns only `.env.example`.

**App Assets & Branding:**
- [ ] App icon (`assets/icon.png`), adaptive icon (`assets/adaptive-icon.png`), splash (`assets/splash-icon.png`) are final.
- [ ] Play listing graphics uploaded: 2–8 screenshots, feature graphic (1024×500).
- [ ] Play store listing details complete: short + full description, support email.

**Legal & Compliance:**
- [ ] Privacy Policy URL is live and set as `EXPO_PUBLIC_PRIVACY_POLICY_URL`.
- [ ] Terms of Service URL is live and set as `EXPO_PUBLIC_TERMS_URL`.
- [ ] Both links appear in app (`app/(private)/account.tsx` buttons).
- [ ] Content rating questionnaire completed in Play Console.
- [ ] Android permissions declared in `app.json` (currently `[]`; update if needed).

**Code Quality:**
- [ ] `npm run typecheck` passes (no TypeScript errors).
- [ ] `npm test` passes (16 tests).
- [ ] No `console.log` left in production code paths (except error logging).
- [ ] No hardcoded secrets or URLs (all env vars used correctly).

**Build & Release:**
- [ ] Local Android build succeeds:
  ```bash
  npx expo prebuild --platform android && cd android && ./gradlew bundleRelease
  ```
- [ ] AAB successfully uploaded to Play Console internal testing track.
- [ ] iOS build path is configured in RevenueCat and App Store Connect before TestFlight rollout.
- [ ] Internal testing on a real device or emulator passed:
  - Auth, free content, paid content purchase, restore, expiry.
  - All snackbar messages display correctly.
  - No crashes or errors.

**CI & Git:**
- [ ] All GitHub Actions checks pass (install, audit, typecheck, tests).
- [ ] Git history is clean; no uncommitted changes (`git status` clean).
- [ ] Tag created and pushed:
  ```bash
  git tag -a v1.0.0 -m "Release 1.0.0: Initial public release with Google Play billing"
  git push origin v1.0.0
  ```

**Documentation:**
- [ ] `READMEPLAYSTORE.md` is up-to-date with Phases 1-4 and this checklist.
- [ ] `OBSERVABILITY.md` queries tested locally.
- [ ] Team/maintainers briefed on release and next steps (e.g., monitoring, bug fixes).

## Immediate next actions for this repo

1. Set `EXPO_PUBLIC_EAS_PROJECT_ID` so `app.config.ts` can inject the correct `updates.url` during builds.
2. Set `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` and `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` in local env files and CI secrets.
3. Configure the RevenueCat offering, entitlement, and webhook authorization header before first subscription test.
4. Set `EXPO_PUBLIC_PRIVACY_POLICY_URL` and `EXPO_PUBLIC_TERMS_URL` so legal links resolve in-app.
5. Configure `SPINO_UPLOAD_*` locally in `~/.gradle/gradle.properties` (never commit).
6. Keep `/android` ignored in git; regenerate locally only when needed.
7. Use this checklist before first mobile store submission.
