# Play Store + Subscription Release Guide

This document combines Play Store preparation and subscription rollout into one practical, ordered guide for this repository.

## Scope

Use this guide when preparing an Android release that includes paid digital access via Google Play Billing and Supabase entitlement checks.

## Current baseline in this repo

- App name: `Spino`
- Expo slug: `spino-mobile`
- Android package: `com.spino.mobile`
- Deep-link scheme: `spino`
- Billing path: Google Play purchase token verification via Supabase

Primary files involved:

- `app.json`
- `supabase/functions/verify-google-play-purchase/index.ts`
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

## Phase 3: Google Play subscription setup

### 3.1 Product setup

- [ ] Create monthly and yearly subscriptions in Play Console.
- [ ] Record product IDs and validate they match app config.

Required app env:

- `EXPO_PUBLIC_GOOGLE_PLAY_PRODUCT_ID_MONTHLY`
- `EXPO_PUBLIC_GOOGLE_PLAY_PRODUCT_ID_YEARLY`
- `EXPO_PUBLIC_GOOGLE_PLAY_ANDROID_PACKAGE_NAME`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_TERMS_URL`
- `EXPO_PUBLIC_EAS_PROJECT_ID` (used by `app.config.ts` to inject `updates.url`)

Required function secrets:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` — Service account email for Google Play API authentication.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` — Service account private key (PEM format). Supabase stores as literal `\n` separators; the function normalizes them.
- `GOOGLE_PLAY_ANDROID_PACKAGE_NAME` — Default package name for verification (e.g., `com.spino.mobile`). Falls back to this if not provided by client.
- `GOOGLE_PLAY_ALLOWED_PACKAGE_NAMES` (optional) — Comma-separated list of allowed package names. Example: `com.spino.mobile,com.spino.mobile.beta`. If both this and the default are empty, verification fails. Use this to allowlist production, beta, and staging builds independently.

### 3.2 Purchase and verification path

- [ ] App starts purchase through Google Play Billing.
- [ ] Purchase token is sent to `verify-google-play-purchase`.
- [ ] Backend upserts `subscriptions` with `provider = 'google_play'`.
- [ ] Access unlocks immediately after successful verification.

### 3.3 Entitlement and restore behavior

- [ ] Paid screens gate on active subscription and non-expired `current_period_end`.
- [ ] Restore purchases flow re-verifies available purchase tokens.
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
  - Subscription: purchase, verify completion, check entitlement state.
  - Restore: uninstall app, re-install, tap "Restore Google Play purchases".
  - Cancel/expiry: cancel subscription in Play Store, check app reflects loss of access.
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
- [ ] Google Play subscriptions are purchasable from the app.
- [ ] Verification writes authoritative entitlement state in Supabase.
- [ ] Access behavior is correct on purchase, restore, expiry, and cancel.
- [ ] Internal testing build passes end-to-end validation.
- [ ] Content rating questionnaire is complete in Play Console.
- [ ] All legal and support links are live and linked in app.
- [ ] Pre-release checklist below is satisfied.

---

## Pre-release checklist

Copy and complete before tagging `v1.0.0` and submitting to Play Store:

**Environment & Configuration:**
- [ ] All Supabase Edge Function secrets are set (Google Play service account, allowed package names, private key in PEM format).
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
2. Set `EXPO_PUBLIC_PRIVACY_POLICY_URL` and `EXPO_PUBLIC_TERMS_URL` so legal links resolve in-app.
3. Configure `SPINO_UPLOAD_*` locally in `~/.gradle/gradle.properties` (never commit).
4. Keep `/android` ignored in git; regenerate locally only when needed.
5. Use this checklist before first Play Store submission.
