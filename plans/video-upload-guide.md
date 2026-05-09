# Video Upload Guide — Step by Step

> **DB is ready.** Migration applied, 117 mock rows deleted. This guide covers everything needed to go from raw video files to live rows in the database.

---

## Step 0 — Get your admin user ID

The `user_id` field on every video row must be a valid UUID from `auth.users`. Get it from:

**Supabase dashboard → Authentication → Users → click your account → copy the UUID**

Keep it handy; you'll paste it into every INSERT row.

---

## Step 1 — Create the Storage buckets

In **Supabase dashboard → Storage → New bucket**, create these three:

| Bucket name | Public? | Stores |
|---|---|---|
| `videos` | **No** | `.mp4` files |
| `thumbnails` | **Yes** | `.jpg` / `.png` thumbnail images |
| `roadmap-previews` | **Yes** | `.gif` / `.webp` short clips |

The app generates signed URLs for the private `videos` bucket automatically (already wired in the code).

---

## Step 2 — File naming convention

Use this slug map to turn position names into folder names:

| Position | Folder slug |
|---|---|
| Basic on 1 L/R | `basic-on-1-lr` |
| Basic on 1 - R/L | `basic-on-1-rl` |
| Basic on 5 - L/R | `basic-on-5-lr` |
| Basic on 5 - R/L | `basic-on-5-rl` |
| Cuddle on 1 | `cuddle-on-1` |
| Cuddle on 5 | `cuddle-on-5` |
| Open Cuddle on 1 | `open-cuddle-on-1` |
| Open Cuddle on 5 | `open-cuddle-on-5` |
| Hammerlock on 1 | `hammerlock-on-1` |
| Hammerlock on 5 | `hammerlock-on-5` |
| Madrid | `madrid` |
| Shadow on 1 | `shadow-on-1` |
| Shadow on 5 | `shadow-on-5` |
| Reverse Shadow on 1 | `reverse-shadow-on-1` |
| Reverse Shadow on 5 | `reverse-shadow-on-5` |

**File path pattern inside each bucket:**
```
bachata/{position-slug}/{filename}

Examples:
  videos bucket    → bachata/basic-on-1-lr/level-1.mp4
  thumbnails       → bachata/basic-on-1-lr/level-1.jpg
  roadmap-previews → bachata/basic-on-1-lr/level-1.gif
```

For position-overview videos (short demo shown on the roadmap canvas left lane), use `position-demo`:
```
bachata/basic-on-1-lr/position-demo.mp4
bachata/basic-on-1-lr/position-demo.gif   ← roadmap preview
```

---

## Step 3 — Fields to fill in for every video

| Field | What it is | Example |
|---|---|---|
| `title` | Display name shown in the app | `"Basic on 1 L/R — Level 1"` |
| `description` | Short sentence about the video | `"Learn the basic bachata step leading left."` |
| `file_path` | Path **inside** the `videos` bucket (not a full URL) | `bachata/basic-on-1-lr/level-1.mp4` |
| `thumbnail_url` | Full public URL from the `thumbnails` bucket | `https://qvdacsdsxkrzceawchng.supabase.co/storage/v1/object/public/thumbnails/bachata/basic-on-1-lr/level-1.jpg` |
| `roadmap_preview_url` | Full public URL from `roadmap-previews` bucket | `https://qvdacsdsxkrzceawchng.supabase.co/storage/v1/object/public/roadmap-previews/bachata/basic-on-1-lr/level-1.gif` |
| `roadmap_gif_url` | Leave `NULL` to reuse `roadmap_preview_url` | `NULL` |
| `dance_type` | Always `'bachata'` for now | `'bachata'` |
| `dance_style` | Always `'fusion'` for now | `'fusion'` |
| `is_position` | `true` only for position-demo overview videos; `false` for all lesson videos | `false` |
| `position_id` | UUID from the table in Step 4 | `650f446a-a031-4c38-a3f6-4dfabeb33915` |
| `user_id` | Your admin UUID from Step 0 | `xxxxxxxx-...` |
| `level` | Difficulty: `1` = beginner → `5` = advanced | `1` |
| `access_tier` | `'free'` for all users, `'paid'` for subscribers only | `'free'` |

---

## Step 4 — Position UUID reference

| # | Position name | UUID |
|---|---|---|
| 1 | Basic on 1 L/R | `650f446a-a031-4c38-a3f6-4dfabeb33915` |
| 2 | Basic on 1 - R/L | `91ecbd8c-3c40-4ed3-a5a6-8d71dd0cfaa0` |
| 3 | Basic on 5 - L/R | `c3c74f56-3473-4dd3-8481-3bb1819999f5` |
| 4 | Basic on 5 - R/L | `0ff136df-011b-4826-9277-06c03070c786` |
| 5 | Cuddle on 1 | `1fdf0056-f6ad-462d-849f-e6445a11ecc1` |
| 6 | Cuddle on 5 | `68035bd1-610b-4b7f-9180-e43d7b461f95` |
| 7 | Open Cuddle on 1 | `09c989f0-e2e9-4f43-8195-9875217dd566` |
| 8 | Open Cuddle on 5 | `76c69cc3-9a3c-4296-9b41-cc2ca8b6cc13` |
| 9 | Hammerlock on 5 | `c4f1c44d-d1eb-41bc-bb14-b0e80f1ca4d1` |
| 10 | Hammerlock on 1 | `50f4611b-108e-4c56-9213-319229327a41` |
| 11 | Madrid | `eec12210-079d-43a1-b1b8-2c05e8c1383b` |
| 12 | Shadow on 1 | `53c99fe1-2764-4d09-b1ca-1f0e46be535a` |
| 13 | Shadow on 5 | `ea65aff8-0079-42a1-a11d-60f3008f249b` |
| 14 | Reverse Shadow on 1 | `12e68d7b-5e87-4c3d-9fe7-b8066db0d49e` |
| 15 | Reverse Shadow on 5 | `f5e07b52-17b1-429f-9901-c4de17f015f0` |

> Positions "Basic on 1" and "Basic on 5" (generic) have `has_videos = false` — skip them.

---

## Step 5 — Upload & fill in the SQL for each video

For each video:

1. **Supabase dashboard → Storage → `videos` bucket** → create folder `bachata/{position-slug}/` → upload `.mp4`
   - Note the `file_path` (e.g. `bachata/basic-on-1-lr/level-1.mp4`)
2. **`thumbnails` bucket** → upload `.jpg` → click the file → copy the **Public URL**
3. **`roadmap-previews` bucket** → upload `.gif` → copy the **Public URL**
4. Add a row to [`sql/seed/insert_real_videos.sql`](../sql/seed/insert_real_videos.sql)

Once `insert_real_videos.sql` is filled in, tell Claude and it will run the INSERT directly against the database.
