# Play Store Prep Guide

This guide expands the first two launch steps for this repository:

1. App setup in the repo
2. Native Android project strategy

The goal is to make the path from codebase to Play Store less abstract and easier to execute in order.

## Step 1: App setup in the repo

This step is about defining the app's identity, release behavior, and policy-sensitive product decisions before building anything.

### 1.1 Confirm the app identity

These values define what Google Play and Android see as your app.

- App name: `Spino`
- Expo slug: `spino-mobile`
- Android package name: `com.spino.mobile`
- Deep-link scheme: `spino`
- Current version name: `1.0.0`
- Current version code: `1`

Current source of truth in this repo:

- `app.json`
- `android/app/build.gradle`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/res/values/strings.xml`

What each value means:

- App name: what users see on the device and in store-facing branding.
- Package name: the permanent unique Android identifier. Once released on Play, changing it means creating a new app listing.
- Scheme: used for app deep links, including auth and checkout returns.
- Version name: user-facing release label.
- Version code: integer Android uses for upgrade ordering. Every Play Store upload must increase this.

### 1.2 Verify app config is internally consistent

Before building, confirm these are aligned:

1. `app.json` app name matches Android string resources.
2. `app.json` Android package matches Gradle `applicationId` and `namespace`.
3. Android manifest deep-link scheme matches the Expo scheme.
4. Version values are intentionally chosen for the upcoming release.

For this repo, that means keeping these values in sync:

- `app.json -> expo.name`
- `app.json -> expo.android.package`
- `app.json -> expo.scheme`
- `android/app/build.gradle -> namespace`
- `android/app/build.gradle -> applicationId`
- `android/app/build.gradle -> versionCode`
- `android/app/build.gradle -> versionName`
- `android/app/src/main/AndroidManifest.xml -> intent-filter data android:scheme`

### 1.3 Set release versioning rules now

Use a simple rule so releases do not get blocked later.

Recommended rule:

- `versionName`: semantic release label such as `1.0.0`, `1.0.1`, `1.1.0`
- `versionCode`: always increment by 1 for every Play upload

Example:

- Internal test build: `versionName 1.0.0`, `versionCode 1`
- Next upload after a bug fix: `versionName 1.0.1`, `versionCode 2`
- Next feature release: `versionName 1.1.0`, `versionCode 3`

Do not reuse a previous version code. Google Play will reject it.

### 1.4 Review Android permissions before submission

Every permission increases review surface area. Keep only what the app actually needs.

Current minimal permissions in this repo:

- `INTERNET`
- `VIBRATE`

That is a good baseline. If a package later adds more permissions, review them before uploading.

### 1.5 Confirm icons, splash, and branding assets

Before release, verify these assets are final or at least good enough for testing:

- App icon
- Adaptive icon
- Splash image
- Store screenshots
- Store feature graphic

In this repo, app runtime assets are configured from `app.json`. Play Console listing graphics are uploaded separately in Google Play Console.

### 1.6 Decide the billing model before production submission

This is not a cosmetic choice. It affects whether the app can be approved on Play.

Current repo state:

- The app has in-app subscription purchase UI.
- The current flow opens Stripe checkout.

Important rule:

- If users buy digital content, digital access, or digital subscriptions consumed in the Android app, Google Play usually requires Play Billing.

That means you should treat this as a required product decision before production rollout.

Practical interpretation for this app:

- If the subscription unlocks app content/features for end users inside the Android app, plan for Play Billing.
- If Stripe remains the only path, expect Play review risk or rejection.

### 1.7 Set up release signing inputs

Android builds for Play must be signed.

This repo is prepared to read release signing values from Gradle properties:

- `SPINO_UPLOAD_STORE_FILE`
- `SPINO_UPLOAD_STORE_PASSWORD`
- `SPINO_UPLOAD_KEY_ALIAS`
- `SPINO_UPLOAD_KEY_PASSWORD`

Recommended storage location:

- local machine or CI in `~/.gradle/gradle.properties`

Do not commit the keystore or passwords to git.

### 1.8 Step 1 completion checklist

Step 1 is complete when all of the following are true:

- App name is final enough for testing.
- Package name is final.
- Scheme is final and matches Android config.
- Version name and version code are intentionally set.
- Permissions are minimal.
- Billing decision is clear for Android.
- Signing inputs exist outside the repo.

## Step 2: Native Android project strategy

This step is about deciding how your Android folder is managed and ensuring the build can be reproduced reliably.

### 2.1 Understand what the Android folder is

The `android/` directory is the real Android app project used by Gradle to compile an Android App Bundle (`.aab`).

It contains:

- Gradle build logic
- Android manifest
- native app resources
- signing/build configuration hooks

Without that native project, Android cannot produce a Play-uploadable bundle.

### 2.2 Understand the two valid strategies

There are two normal ways to manage native Android files in an Expo app.

#### Option A: Generated native project

How it works:

- `android/` is not committed.
- The native project is regenerated from Expo config/plugins when needed.

Best when:

- you stay close to standard Expo behavior
- all native changes are represented in config/plugins
- you want less native code in version control

Risk:

- manual edits inside `android/` are disposable unless encoded elsewhere

#### Option B: Tracked native project

How it works:

- `android/` is committed to git
- manual Gradle/Manifest/resource changes are preserved in repository history

Best when:

- you need deterministic native builds
- you have manual Android changes
- you are preparing store release and want fewer surprises

Risk:

- more native files in git
- upgrades can require more merge/conflict management

### 2.3 What this repo currently looks like

Current state:

- `android/` exists locally
- `.gitignore` ignores `/android`
- the Android native files are not tracked in git
- some release-critical edits currently live in native Android files

That means this repo is currently in an in-between state:

- native files exist and matter
- but the repo alone does not fully recreate them from git history

### 2.4 Recommended strategy for this repo right now

For Play Store release work, the safer choice is:

1. Commit `android/` to git now
2. Keep signing secrets out of git
3. Build and release from the tracked native project

Why this is the pragmatic choice:

- you already have release-specific native edits
- release builds are less error-prone when the exact Android project is versioned
- it gives you a reproducible baseline for Play submission

After launch, you can choose whether to:

- continue tracking `android/`, or
- migrate native changes into Expo plugins/config and go back to generated native folders

### 2.5 What to do if you keep Android generated instead

If you do not want to commit `android/`, then every native change must live in one of these places instead:

- `app.json` or app config
- Expo config plugins
- build scripts that regenerate native changes consistently

That is a valid approach, but it requires discipline. Manual edits to Gradle or Manifest cannot be treated as durable unless they are reproduced automatically.

### 2.6 What should and should not be committed

Commit:

- `android/app/build.gradle`
- `android/gradle.properties` (without secrets)
- `android/app/src/main/AndroidManifest.xml`
- resource files and code needed to build

Do not commit:

- `.jks` keystore files
- passwords
- secret env files with production secrets

This matches your current `.gitignore` strategy for secrets, but if you choose tracked Android, you should stop ignoring `/android` itself.

### 2.7 Step 2 completion checklist

Step 2 is complete when all of the following are true:

- You have explicitly chosen generated vs tracked Android.
- That choice matches how the repo is configured.
- Release-critical Android changes are reproducible from the repo/process.
- Signing secrets are external to git.
- A new machine or CI environment can produce the same release app with documented steps.

## Recommended immediate next move for this repo

If the goal is Play Store submission with the least ambiguity, do this next:

1. Decide to track `android/` in git for now.
2. Remove `/android` from `.gitignore`.
3. Commit the current Android native files except secrets.
4. Generate or obtain the upload keystore and configure `SPINO_UPLOAD_*` locally.
5. Build an internal-testing Android App Bundle.

That gives you a stable release baseline before dealing with Play Console submission and billing policy work.