# Week 1: Stop sharing prod

**Goal for the week:** by Friday, everything you do while developing (local testing, dev builds, test purchases) happens in a separate **dev** environment. Your real users' data in **prod** is never touched by testing again.

**Why:** right now every build of the app (development, preview, production) talks to the same Supabase database (`qvdacsdsxkrzceawchng`) and the same RevenueCat project. If a test migration goes wrong or you make a test purchase, it lands on real users.

**What you will have at the end:**

| | Dev (new) | Prod (existing) |
| --- | --- | --- |
| Supabase project | `spino-dev` | `qvdacsdsxkrzceawchng` |
| RevenueCat project | Spino Dev | Spino (current) |
| Webhook secret | new, different value | current value |
| EAS build profiles that use it | `development`, `preview` | `production` |
| Where the keys live | EAS environment variables | EAS environment variables |

## Before you start: some words you'll see

- **Terminal**: the command line. In VS Code, open it with **Ctrl + `** (backtick). Every command block below runs from the project folder `~/projects/spino-mobile` unless it says otherwise.
- **Supabase CLI**: a command-line tool that talks to your Supabase projects. You'll use it instead of clicking around the dashboard, so every change is written down in a file.
- **Migration**: a `.sql` file describing one change to the database (add a table, add a column…). Applying all migrations in order rebuilds the database from nothing.
- **Project ref**: the ID of a Supabase project. Prod's is `qvdacsdsxkrzceawchng`. You'll get a new one for dev. It's in the dashboard URL: `supabase.com/dashboard/project/<ref>`.
- **EAS**: Expo's build service. It builds your app in the cloud using the settings in `eas.json`.
- **Linked project**: the Supabase project the CLI remembers from `supabase link`. In this guide it matters less, because every command names its target explicitly (see the tip below).
- **Local stack**: a full copy of Supabase running on your Mac in Docker, started with `supabase start`. **This week's plan doesn't need it.** Stop it with `supabase stop` to free memory.
- **`--remote=<ref>`**: Supabase CLI 3 sends database commands to the **local stack** unless you add this flag. With it, the command goes to the project whose ref you give.

> **The most important habit this week**
> Every command in this guide that touches a real Supabase project says which one, with `--remote=...` at the end:
> - `--remote=qvdacsdsxkrzceawchng` means **PROD**
> - `--remote=<DEV_REF>` means dev
>
> **Read the ref before you press Enter.** If you forget `--remote` completely, the command goes to the local copy on your Mac (or fails because it isn't running). That's harmless.
>
> **Prompts now default to No.** When the CLI asks `[y/N]`, pressing Enter means **No**. Type `y` to agree.

## Quick checklist

Tick these off as you go. Each one is explained in detail below.

- [ ] 1. Install the tools
- [ ] 2. Create a working branch
- [ ] 3. Log in to Supabase and connect the CLI to prod
- [ ] 4. Back up prod
- [ ] 5. Pull prod's schema into the repo (the "baseline")
- [ ] 6. Check the baseline and tidy the old SQL folders
- [ ] 7. Create the `spino-dev` Supabase project
- [ ] 8. Push the baseline into dev
- [ ] 9. Create storage buckets and test users in dev
- [ ] 10. Deploy the webhook function to dev
- [ ] 11. Create the Spino Dev RevenueCat project
- [ ] 12. Connect the dev RevenueCat webhook
- [ ] 13. Create EAS environment variables
- [ ] 14. Remove the keys from `eas.json`
- [ ] 15. Remove the keys from `app.json`
- [ ] 16. Pull the dev keys to your laptop
- [ ] 17. Clean up your local `.env`
- [ ] 18. Build a new dev client
- [ ] 19. Test it end to end
- [ ] 20. Commit and open a pull request

**Rough timing:** day 1 is steps 1–6, day 2 is steps 7–10, day 3 is steps 11–12, day 4 is steps 13–17, and day 5 is steps 18–20.

# Day 1: Prepare and protect prod

## Step 1. Install the tools

**What:** install the Supabase CLI, update the EAS CLI, and make sure Docker is running.

**Why:** the Supabase CLI does most of this week's work. Some of its commands (`db pull`, `db dump`) quietly start a temporary database inside Docker, so Docker must be running.

**Do this:**

1. Install the Supabase CLI with Homebrew:
   ```bash
   brew install supabase/tap/supabase
   ```
2. Check it worked:
   ```bash
   supabase --version
   ```
   You should see a version number such as `3.x.x`. This guide is written for **CLI 3**. Older guides online use `--linked` and `--project-ref` instead of `--remote`. Those still work for now but print warnings.
3. Update the EAS CLI. You have 18.11, and 27.x is available:
   ```bash
   npm install -g eas-cli
   eas --version
   ```
4. Open **Docker Desktop** from Applications. Wait until the whale icon in the menu bar stops animating. Check it:
   ```bash
   docker ps
   ```
   An empty table (just column headings) is fine. An error like "Cannot connect to the Docker daemon" means Docker isn't running yet.
5. Make sure you're logged in to Expo:
   ```bash
   eas whoami
   ```
   It should print `spinodancemethod` (or your Expo username). If not, run `eas login`.

**Done when:** `supabase --version`, `eas --version` and `docker ps` all work without errors.

## Step 2. Create a working branch

**What:** a separate git branch for this week's changes.

**Why:** if something goes badly, you can throw the branch away and `main` is untouched.

**Do this:**

```bash
git checkout main
git pull
git checkout -b infra/dev-environment
```

**Done when:** `git branch --show-current` prints `infra/dev-environment`.

## Step 3. Log in to Supabase and connect the CLI to prod

**What:** give the CLI permission to use your Supabase account, create the `supabase/config.toml` file, and point the CLI at prod.

**Why:** the CLI needs your login to reach your projects. Linking to prod also tells it how prod's API and settings are configured. The next two steps (backup and schema pull) read from prod. They don't change your app's data.

**Do this:**

1. Log in. This opens your browser to approve it:
   ```bash
   supabase login
   ```
2. Set up the CLI files in the repo:
   ```bash
   supabase init
   ```
   - If it asks **"Generate VS Code settings for Deno?"**, answer `y`. This helps VS Code understand the edge function code.
   - Your existing `supabase/functions/` folder is kept. The command adds `supabase/config.toml` and a `supabase/.gitignore`.
3. Tell the CLI the webhook function must not require a logged-in user. RevenueCat calls it from its servers, not from the app. Prod already has this setting off, and this makes the repo match. Open `supabase/config.toml` and add this at the end of the file:
   ```toml
   [functions.ingest-revenuecat-webhook]
   verify_jwt = false
   ```
4. Connect the CLI to prod:
   ```bash
   supabase link --project-ref qvdacsdsxkrzceawchng
   ```
   It asks for the **database password**. This is the password you chose when you created the Supabase project.
   - Can't remember it? Look in your password manager first.
   - You can reset it in the dashboard under **Project Settings → Database → Reset database password**. **Warning:** anything that connects with the old password directly (for example the Python worker, if it uses a database connection string) stops working until you update it. Only reset if you have to.

**Done when:** `cat supabase/.temp/project-ref` prints `qvdacsdsxkrzceawchng`.

## Step 4. (Optional) Back up prod

**What:** save a copy of prod's structure and data to files on your Mac.

**Do you need this?** Probably not. Prod has no real users yet, only content you created while testing. And Step 5 doesn't change your tables or data. It only edits prod's *migration history list*. So skip this step unless you'd be annoyed at having to recreate your test roadmaps, categories and notes by hand if something unexpected happened. It takes about a minute.

**Note:** this only saves the database. Files in Storage (videos, category images) are **not** included.

**Do this (if you want the safety net):**

1. Make a backup folder **outside** the project, so it can never be committed to git by accident:
   ```bash
   mkdir -p ~/spino-backups
   ```
2. Dump the structure and the data:
   ```bash
   supabase db dump -f ~/spino-backups/prod-schema-$(date +%Y%m%d).sql --remote=qvdacsdsxkrzceawchng
   supabase db dump --data-only -f ~/spino-backups/prod-data-$(date +%Y%m%d).sql --remote=qvdacsdsxkrzceawchng
   ```
   Each one asks for prod's database password.

**Done when:** `ls -lh ~/spino-backups` shows two files, neither 0 bytes.

**If it goes wrong:** an error mentioning Docker means Docker Desktop isn't running (see Step 1).

## Step 5. Pull prod's schema into the repo (the "baseline")

**What:** generate one migration file that recreates prod's whole database structure exactly as it is today.

**Why:** at the moment the repo **cannot** rebuild prod. Some changes were made directly in the dashboard and never saved as files (e.g. `admin_select_bypass`, `create_ai_position_analysis`). Once you have this "baseline" file, you can build an identical dev database from it, and every future change gets added as a new file on top.

**Before you start:** Docker Desktop must be running. `db pull` starts its own temporary database in Docker to compare against. You do **not** need `supabase start`. If you already ran it, that's fine.

Every command below ends in `--remote=qvdacsdsxkrzceawchng`, so each one reads or writes **prod**. Each one asks for prod's database password.

**Do this:**

1. See how prod's migration history compares with the repo:
   ```bash
   supabase migration list --remote=qvdacsdsxkrzceawchng
   ```
   You'll see two columns, **Local** and **Remote**. Local is empty because `supabase/migrations/` doesn't exist yet. Remote shows the ~33 migrations prod has recorded.

   If the Remote column is empty, you've forgotten `--remote=...` and you're looking at the local copy on your Mac. Run it again with the flag.

2. Clear the old history records. This **only changes the history list**. Your tables and data are not touched. Copy every version number from the Remote column in step 1. Put them all after `repair`, separated by spaces, and keep `--remote=...` at the very end:
   ```bash
   supabase migration repair <version1> <version2> <version3> ... --status reverted --remote=qvdacsdsxkrzceawchng
   ```
   It asks you to confirm because this changes prod. Type `y`.

   **Why this is needed:** those ~33 records describe changes that were never saved as files in this repo. Clearing them lets the next command replace them all with one baseline file.

3. Pull the schema:
   ```bash
   supabase db pull --remote=qvdacsdsxkrzceawchng
   ```
   - This takes a minute or two.
   - When it asks **"Update remote migration history table?"**, type `y`. **Don't just press Enter.** Enter means No, and No means **no file is written** at all. Answering `y` records in prod that the baseline is already applied, so nobody ever tries to apply it to prod again.
   - It creates a file like `supabase/migrations/20261106xxxxxx_remote_schema.sql`.

4. Also pull your **storage** rules (who can read and upload which files). These live in a separate schema that the first pull skips:
   ```bash
   supabase db pull --schema storage --remote=qvdacsdsxkrzceawchng
   ```
   Type `y` again if asked. This may create a second, small migration file. If it says "No schema changes found", that's fine too.

**Done when:** `supabase migration list --remote=qvdacsdsxkrzceawchng` shows the same version(s) in both the Local and Remote columns, and `ls supabase/migrations` shows your new file(s).

**If it goes wrong:**
- **"migration history does not match local files":** some version from step 1 wasn't included in step 2. Run step 1 again, repair the versions that are left, then pull again.
- **An error mentioning Docker:** Docker Desktop isn't running (see Step 1).
- **Anything else:** copy the full error and ask Claude before trying fixes on prod.

## Step 6. Check the baseline and tidy the old SQL folders

**What:** open the baseline file and look it over, then move the old hand-run SQL files out of the way.

**Why:** from now on, `supabase/migrations/` is the **only** place schema changes live. Leaving the old `sql/` folders where they are would confuse you (and Claude) later about which files are real.

**Do this:**

1. Open the new file in `supabase/migrations/` in VS Code. Use **Cmd + F** to check a few names you know are there:
   - `create table` for your main tables (roadmaps, categories, video uploads, `subscriptions`, `billing_events`)
   - `create policy` lines (these are your RLS security rules)
   - `reorder_video_categories` (one of your functions)

   You don't need to understand every line. You're just checking it isn't empty or missing obvious things. Step 8 is the real test.

2. Move the old SQL folders into a history folder:
   ```bash
   mkdir -p docs/sql-history
   git mv sql/bootstrap docs/sql-history/bootstrap
   git mv sql/migrations docs/sql-history/migrations
   ```

3. Save your progress:
   ```bash
   git add supabase/ docs/sql-history/
   git status
   ```
   Check the list. It should **not** contain anything from `~/spino-backups` or any `.env` file. Then commit:
   ```bash
   git commit -m "chore: adopt Supabase CLI with baseline migration from prod"
   ```

**Note:** `CLAUDE.md` still says to bootstrap from `sql/bootstrap/`. You can update that line in Step 20.

# Day 2: Build the dev database

## Step 7. Create the `spino-dev` Supabase project

**What:** a brand new, empty Supabase project for development.

**Why:** a separate project has its own database, users, storage and secrets, so nothing done in dev can reach prod.

**Do this:**

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and open the **same organization** prod is in.
2. Click **New project**.
   - **Name:** `spino-dev`
   - **Database password:** click **Generate a password** and **save it in your password manager straight away**, labelled "spino-dev DB password". You'll need it in Step 8.
   - **Region:** the **same region as prod**. To check prod's region, open the prod project and go to **Project Settings → General**.
   - **Plan:** Free.
3. Wait 1–2 minutes for it to finish setting up.
4. Copy the new **project ref** from the browser address bar (`.../project/<this-part>`) and save it somewhere handy. Below it's written as `<DEV_REF>`.

**Good to know:** Supabase pauses free projects after about a week with no activity. If dev stops responding after a break, open it in the dashboard and click **Restore**.

**Done when:** the dev project's dashboard loads and shows an empty Table Editor.

## Step 8. Push the baseline into dev

**What:** run the baseline migration against the empty dev database.

**Why:** this gives dev exactly the same structure as prod. It's also the real test of Step 5: if this works, the repo can now rebuild your database from scratch.

**Do this:**

Every command here ends in `--remote=<DEV_REF>`. Replace `<DEV_REF>` with dev's ref from Step 7. **Check it isn't `qvdacsdsxkrzceawchng` before pressing Enter.** These commands ask for the **dev** database password from Step 7.

1. Preview what will run, without changing anything:
   ```bash
   supabase db push --dry-run --remote=<DEV_REF>
   ```
   It should list your baseline file (and the storage one, if Step 5 made it).
2. Push for real:
   ```bash
   supabase db push --remote=<DEV_REF>
   ```
   It asks you to confirm. Type `y`.
3. Make dev the linked project, so the CLI's default is dev rather than prod from now on:
   ```bash
   supabase link --project-ref <DEV_REF>
   cat supabase/.temp/project-ref
   ```
   The second command must print your `<DEV_REF>`.

**Done when:** the push finishes without errors, and the dev dashboard's **Table Editor** shows the same tables as prod (with no data in them).

**If it goes wrong:**

- An error mentioning an **extension** (e.g. `pgtap`, `vector`): in the dev dashboard go to **Database → Extensions**, switch that extension on, then run step 2 again.
- Any other error: copy the full error message and ask Claude. Don't edit prod to work around it.

## Step 9. Create storage buckets and test users in dev

**What:** recreate prod's six storage buckets in dev, and create two test accounts.

**Why:** the migration only copies the database structure. Buckets are configuration, and users are data, so neither gets copied. The app breaks without the buckets, and you need test accounts to log in.

**Do this:**

1. Create the file `supabase/seed.sql` with this content. These are prod's exact bucket settings:
   ```sql
   -- Storage buckets, matching prod's settings.
   -- Bucket settings aren't stored in migrations, so they live here.
   -- "on conflict do nothing" makes it safe to run more than once.
   insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   values
     ('videos',           'videos',           false, null,     array['video/mp4']),
     ('thumbnails',       'thumbnails',       true,  null,     array['image/jpeg','image/jpg','image/png','image/webp']),
     ('roadmap-previews', 'roadmap-previews', true,  null,     array['image/gif','image/webp']),
     ('dance-analysis',   'dance-analysis',   false, null,     null),
     ('analysis-audio',   'analysis-audio',   false, 20971520, array['audio/mp4','audio/m4a','audio/x-m4a','audio/aac','audio/wav','audio/x-wav','audio/mpeg']),
     ('category-images',  'category-images',  true,  5242880,  array['image/jpeg','image/jpg','image/png','image/webp'])
   on conflict (id) do nothing;
   ```
2. Apply it to dev:
   ```bash
   supabase db push --include-seed --remote=<DEV_REF>
   ```
   Type `y` when it asks to confirm. If it also asks whether to run the seed, type `y` again.
3. Create the test users in the **dev** dashboard under **Authentication → Users → Add user → Create new user**:
   - `free-test@spinodancemethod.com` with any password, **Auto Confirm User** ticked
   - `paid-test@spinodancemethod.com` with any password, **Auto Confirm User** ticked

   Save both passwords in your password manager. These accounts exist **only in dev**.
4. Test data (a roadmap, a category, a video): the easiest way is to create it through the app itself in Step 19. Later, Claude can turn that into seed SQL so you can rebuild dev in one command.

**Done when:** the dev dashboard's **Storage** page shows all six buckets, and **Authentication → Users** shows your two test users.

## Step 10. Deploy the webhook function to dev

**What:** put a copy of `ingest-revenuecat-webhook` on the dev project, with its **own** secret password.

**Why:** RevenueCat tells your app about purchases by calling this function. Dev purchases must go to the dev copy, and the dev copy must use a different secret from prod. Then a leaked dev secret can't be used against prod.

**Do this:**

Type `y` whenever these commands ask to confirm.

1. Deploy the function to dev:
   ```bash
   supabase functions deploy ingest-revenuecat-webhook --remote=<DEV_REF>
   ```
2. Generate a random secret:
   ```bash
   openssl rand -hex 32
   ```
   Copy the long string it prints and save it in your password manager as "spino-dev RevenueCat webhook secret".
3. Store it on the dev project:
   ```bash
   supabase secrets set REVENUECAT_WEBHOOK_AUTHORIZATION=<the string from step 2> --remote=<DEV_REF>
   ```
   You don't need to set `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`. Supabase provides those to every function automatically.
4. Check it's working by calling it with a **wrong** password. It should refuse:
   ```bash
   curl -i -X POST https://<DEV_REF>.supabase.co/functions/v1/ingest-revenuecat-webhook \
     -H "Authorization: wrong" -H "Content-Type: application/json" -d '{}'
   ```

**Done when:** the curl response starts with `HTTP/2 401` and contains `Unauthorized webhook request`. That means the function is live and checking the secret.

**If you get a 500 error** mentioning missing environment variables, the secret from step 3 didn't save. Run it again.

# Day 3: Set up the dev RevenueCat project

## Step 11. Create the Spino Dev RevenueCat project

**What:** a second RevenueCat project that mirrors your real one.

**Why:** today, a test (sandbox) purchase from a dev build goes through the same webhook into the **prod** `billing_events` and `subscriptions` tables. That could mark a real user as subscribed, or create a fake subscriber. A separate project sends test purchases only to dev. It's free.

**Before you start:** open your existing prod RevenueCat project in another browser tab. You'll copy settings from it.

**Do this:**

1. In [app.revenuecat.com](https://app.revenuecat.com), open the project menu (top left) → **Create new project**. Name it `Spino Dev`.
2. **Add the Android app** (Project settings → Apps → **+ New** → Google Play):
   - **Package name:** `com.spino.mobile`
   - **Service account credentials JSON:** upload the same Google Play service account JSON file you used for the prod project. Check the prod project's Android app settings to see which one.
3. **Add the iOS app** (Apps → **+ New** → App Store), if you sell on iOS:
   - **Bundle ID:** the same one as in the prod project. Note: `app.json` doesn't set `ios.bundleIdentifier` yet, so copy it from RevenueCat prod or App Store Connect.
   - **In-App Purchase key (.p8)** and **Issuer ID**: the same ones as prod.
4. **Products** (Product catalog → Products): add the same product IDs as prod (e.g. your monthly and yearly subscriptions). The IDs must match **exactly**.
5. **Entitlement** (Product catalog → Entitlements → **+ New**):
   - **Identifier:** `Spinodancemethod ltd Pro`. Copy this exactly, including the capital letters and spaces. The app looks for this exact text.
   - Attach all the products from step 4.
6. **Offering** (Product catalog → Offerings → **+ New**):
   - Use the **same identifier** as your prod offering (often `default`).
   - Add the same packages (monthly, annual…), each linked to the matching product.
   - Make it the **current** offering.
7. **Get the API keys** (Project settings → API keys). Copy and save:
   - the **Google Play** public key (starts with `goog_`)
   - the **App Store** public key (starts with `appl_`), if you added iOS
   - the **Test Store** key, if one is shown (used when running in Expo Go)

**Done when:** the Spino Dev project has your app(s), the same products, an entitlement called exactly `Spinodancemethod ltd Pro`, a current offering, and you've saved the API keys.

## Step 12. Connect the dev RevenueCat webhook

**What:** tell Spino Dev to send purchase events to the **dev** function from Step 10.

**Do this:**

1. In **Spino Dev**, go to **Integrations → Webhooks → + New webhook** (in some layouts it's under Project settings → Integrations).
   - **Name:** `Supabase dev`
   - **Webhook URL:** `https://<DEV_REF>.supabase.co/functions/v1/ingest-revenuecat-webhook`
   - **Authorization header value:** the exact secret from Step 10, step 2. Paste it on its own, with no extra words and no spaces.
   - **Environment:** if there's an option, choose **Sandbox** (or Both).
2. Save it, then click **Send test event**.
3. Check it arrived: in the **dev** Supabase dashboard, open **Table Editor → `billing_events`**. You should see one new row.
4. **Extra protection for prod:** open your **prod** RevenueCat project's webhook settings. If there's an environment option, set it to **Production only**. Then sandbox purchases can never reach prod, even by mistake.

**Done when:** the test event shows up as a row in **dev** `billing_events`.

**If it goes wrong:** in RevenueCat, check the webhook's delivery log.
- A **401** means the authorization value doesn't exactly match the secret. Check for spaces at the start or end.
- A **404** means the URL is wrong. Check `<DEV_REF>`.

# Day 4: Move the keys out of the code

## Step 13. Create EAS environment variables

**What:** store each environment's keys in Expo's dashboard instead of in `eas.json`.

**Why:**
- Right now the prod keys are written into `eas.json` three times, once per build profile, and committed to git.
- With EAS environment variables, the `development` and `preview` builds automatically get dev keys, and `production` builds get prod keys.
- `eas.json` then contains no keys at all.

**Collect these values first:**

| Variable | Dev value comes from | Prod value |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<DEV_REF>.supabase.co` | `https://qvdacsdsxkrzceawchng.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | dev dashboard → Project Settings → API Keys → publishable key (`sb_publishable_…`) | copy from the current `eas.json` |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Spino Dev `appl_…` key (Step 11) | copy from the current `eas.json` |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | Spino Dev `goog_…` key (Step 11) | copy from the current `eas.json` |
| `EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID` | `Spinodancemethod ltd Pro` | `Spinodancemethod ltd Pro` |
| `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY` | Spino Dev Test Store key (optional) | leave it out |

**Do this (the easiest way is the website):**

1. Go to [expo.dev](https://expo.dev) → your project → **Environment variables**.
2. For each variable, click **Add variable**:
   - **Name:** e.g. `EXPO_PUBLIC_SUPABASE_URL`
   - **Value:** the **dev** value
   - **Environments:** tick **development** and **preview** only
   - **Visibility:** **Plain text** (these keys end up inside the app anyway, so they aren't secret). Don't choose "Secret", because secret values can't be downloaded in Step 16.
3. Repeat each variable with the **prod** value and only **production** ticked.

**Or with the command line**, one environment at a time:

```bash
eas env:create --environment development --name EXPO_PUBLIC_SUPABASE_URL --value https://<DEV_REF>.supabase.co --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<DEV_REF>.supabase.co --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://qvdacsdsxkrzceawchng.supabase.co --visibility plaintext
# ...repeat for each variable in the table
```

**Done when:** these three commands show the right values (dev values in the first two, prod values in the third):

```bash
eas env:list --environment development
eas env:list --environment preview
eas env:list --environment production
```

## Step 14. Remove the keys from `eas.json`

**What:** replace each profile's `env` block with one line that says which EAS environment to use.

**Only do this after Step 13 is finished.** Otherwise your next build would have no keys.

**Do this:** replace the whole contents of `eas.json` with:

```json
{
  "cli": {
    "version": ">= 18.5.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development"
    },
    "preview": {
      "distribution": "internal",
      "environment": "preview"
    },
    "production": {
      "autoIncrement": true,
      "environment": "production"
    }
  },
  "submit": {
    "production": {}
  }
}
```

**Done when:** searching `eas.json` for `sb_publishable`, `goog_` or `appl_` finds nothing.

## Step 15. Remove the keys from `app.json`

**What:** delete the two hard-coded Supabase values from `app.json`.

**Why:** `app.config.ts` already adds these values at build time from the environment variables. The copy in `app.json` always points at prod, so if anything went wrong, a dev build could silently fall back to prod.

**Do this:** in `app.json`, find the `"extra"` section (around line 60) and delete these two lines:

```json
"supabaseUrl": "https://qvdacsdsxkrzceawchng.supabase.co",
"supabasePublishableKey": "sb_publishable_PU3fPcE2TK_6iuUX_imEdA_IWWpxsS6",
```

Leave `"router"` and `"eas"` where they are. The section should then look like:

```json
"extra": {
  "router": {},
  "eas": {
    "projectId": "b35e90fe-4990-4c3c-9eef-d1edb26e6255"
  }
},
```

Then check nothing broke:

```bash
npm run typecheck
```

**Done when:** typecheck passes and searching `app.json` for `qvdacsdsxkrzceawchng` finds nothing.

## Step 16. Pull the dev keys to your laptop

**What:** download the `development` variables into a local file, so `npm start` uses dev.

**Do this:**

```bash
eas env:pull --environment development
```

This writes a file called `.env.local`. It's already in `.gitignore`, so it won't be committed. Open it and check that the Supabase URL contains your `<DEV_REF>`.

**Done when:** `.env.local` exists and points at dev.

## Step 17. Clean up your local `.env`

**What:** remove the prod keys from your old `.env` file.

**Why:** Expo reads both `.env` and `.env.local`. `.env.local` wins, but leaving prod keys in `.env` is a trap: delete `.env.local` and you're silently back on prod.

**Do this:**

1. Open `.env` and delete these lines:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - all the `EXPO_PUBLIC_REVENUECAT_*` lines
   - `DEV_USER_ID`. The code no longer uses it; the login bypass was removed earlier, so this is leftover.
2. If nothing useful is left in `.env`, you can delete the file.

**Done when:** `grep qvdacsdsxkrzceawchng .env .env.local` finds nothing. An error saying `.env` doesn't exist is also fine.

# Day 5: Prove it works

## Step 18. Build a new dev client

**What:** a fresh development build of the app with the dev keys baked in.

**Why:** your current dev build on your phone was built with prod keys. It has to be rebuilt to pick up the new ones.

**Do this:**

1. **iPhone only, first time:** register your phone so it can install internal builds:
   ```bash
   eas device:create
   ```
   Follow the link it gives you on your phone.
2. Start the build. Pick the platform you test purchases on:
   ```bash
   eas build --profile development --platform android
   # or
   eas build --profile development --platform ios
   ```
   - It prints **"Environment: development"** near the start. That confirms it's using the dev variables.
   - The build runs in Expo's cloud and takes about 10–25 minutes.
3. When it finishes, scan the QR code with your phone to install it. **Delete the old dev build from your phone first**, so you don't mix them up.

**Done when:** the new dev build is installed on your phone.

## Step 19. Test it end to end

**What:** confirm the dev build talks only to dev, and the purchase flow works.

**Do this:**

1. Start the dev server:
   ```bash
   npm start
   ```
   Open the app on your phone and connect to the server.
2. **Login test:**
   - Log in as `free-test@spinodancemethod.com`. It should work.
   - Log out and try **your real prod account**. It should **fail**, because that user doesn't exist in dev. This is the proof you're on dev.
3. **Data test:** while logged in as `free-test`, create a roadmap and a category, and add a video.
   - Check the **dev** dashboard's Table Editor: the new rows are there.
   - Check the **prod** dashboard: nothing new.
4. **Purchase test:** set up a test account first.
   - **Android:** in Play Console go to **Settings → License testing** and add your Google account as a license tester. Use that Google account on the phone.
   - **iPhone:** in App Store Connect go to **Users and Access → Sandbox → Test accounts** and create a sandbox tester. On the phone, sign in under **Settings → App Store → Sandbox Account**.

   Then log in to the app as `paid-test@spinodancemethod.com` and buy a subscription. Test purchases aren't charged.
5. **Check the purchase landed in the right place:**
   - **Spino Dev** RevenueCat: Customers (switch the "sandbox data" toggle on) shows the purchase.
   - **dev** Supabase `billing_events` has a new row, and `subscriptions` has a row for `paid-test`.
   - **prod** Supabase `billing_events` has **no** new row.
   - The app now shows paid content for `paid-test`.

**Done when:** all four checks in item 5 pass.

**If the purchase screen shows no products:**
- Check the Spino Dev offering is set as **current** (Step 11.6).
- Check the product IDs match the store exactly.
- On Android, the app must have been uploaded at least once to a Play Console testing track. It already has, if you've released before.

## Step 20. Commit and open a pull request

**Do this:**

1. Run the checks:
   ```bash
   npm run typecheck && npm test
   ```
2. Update the docs:
   - **`FEATURES.md`:** add a line such as "Separate dev/prod environments: spino-dev Supabase project, Spino Dev RevenueCat project, EAS environment variables."
   - **`CLAUDE.md`:** replace the "Bootstrap a fresh Supabase project by running `sql/bootstrap/`…" line with "Schema lives in `supabase/migrations/`. Apply with `supabase db push --remote=<ref>` (dev first, then prod). Supabase CLI 3: commands without `--remote` target the local stack."
   - **`CLAUDE.md`:** remove the `EXPO_PUBLIC_DEV_USER_ID` line.
3. Check what you're about to commit:
   ```bash
   git status
   ```
   Make sure there's **no** `.env`, `.env.local` or backup file in the list.
4. Commit and push:
   ```bash
   git add -A
   git commit -m "feat: separate dev and prod environments"
   git push -u origin infra/dev-environment
   ```
5. Open a pull request on GitHub and let CI run. Merge once it's green.

**Done when:** the PR is merged into `main`.

# If something goes badly wrong

- **App or code changes:** throw away the branch with `git checkout main`. Nothing on `main` changed.
- **Dev database is in a mess:** it doesn't matter. Delete the `spino-dev` project and redo Steps 7–10. That's the point of having dev.
- **Prod database:** apart from the migration history records in Step 5, nothing this week changes prod. If you made the optional backups in Step 4, they're in `~/spino-backups/`. Ask for help before restoring anything into prod.
- **A prod build is needed urgently mid-week:** finish Steps 13–15 first, or build from `main`, which still has the old `eas.json`.

# What's next (Week 2 preview)

Now that dev exists, Week 2 makes prod safer:
- one migration to fix the security warnings and speed up RLS
- turn on leaked-password protection
- move prod to the Pro plan so it gets daily backups
- practise restoring a prod backup into dev
