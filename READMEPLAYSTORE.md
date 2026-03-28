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

## Phase 4: Signing, build, and internal testing

### 4.1 Signing configuration

Define locally or in CI (recommended: `~/.gradle/gradle.properties`):

- `SPINO_UPLOAD_STORE_FILE`
- `SPINO_UPLOAD_STORE_PASSWORD`
- `SPINO_UPLOAD_KEY_ALIAS`
- `SPINO_UPLOAD_KEY_PASSWORD`

### 4.2 Internal test release checklist

- [ ] Build an Android App Bundle for internal testing.
- [ ] Upload to the Play internal track.
- [ ] Validate purchase, entitlement, restore, and cancel/expiry states.

## Definition of done

Release readiness is achieved when all are true:

- [ ] Android identity/version settings are consistent and intentional.
- [ ] Native Android strategy is explicit and reproducible.
- [ ] Google Play subscriptions are purchasable from the app.
- [ ] Verification writes authoritative entitlement state in Supabase.
- [ ] Access behavior is correct on purchase, restore, expiry, and cancel.
- [ ] Internal testing build is uploaded successfully.

## Immediate next actions for this repo

1. Keep `/android` ignored in git.
2. Configure `SPINO_UPLOAD_*` locally.
3. Regenerate Android (`npx expo prebuild --platform android`) when doing Android build/test work.
4. Build and upload an internal testing AAB.
