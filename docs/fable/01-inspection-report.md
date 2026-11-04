# Fable — Prompt 1 report: inspection of the existing application

Date: 2026-10-31. Read-only inspection; no code changed. Spec: `Fable_Master_Spec_Amended.md`.

## 1. Headline findings

1. **Video files never leave the device.** A "video upload" is a `video_uploads` row that points at a device-local file (image-picker asset id + `file://` URI + SHA-256). Supabase Storage is not used anywhere; the old `videos`/`thumbnails` bucket policies were dropped in `sql/migrations/20260816_remove_legacy_catalog.sql`. FEATURES.md and the Add Video screen both promise users the file is not uploaded.
2. **There is no backend processing of any kind.** One Edge Function (RevenueCat webhook), no pg_cron/pg_net, no triggers, no job tables, no `functions.invoke` calls. An empty, git-ignored `worker/ai_position_worker/` scaffold exists from an earlier attempt, containing only an env file with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_ID`, `POLL_INTERVAL_SECONDS`.
3. **The clip model already fits the feature.** `public.segments` stores `start_time`/`end_time` in fractional seconds, has a per-roadmap controlled vocabulary (`video_categories`, with a system `Misc`), and three unused columns made for this: `ai_generated`, `ai_confidence`, `user_confirmed`. Also unused: `sequence`, `count_start`, `count_end`.
4. **Playback by timestamp range already exists.** `Components/LocalSegmentPlayer.tsx` (expo-video) seeks to start, stops at end (0.1 s polling), and has an editable trim range with handles. This is the review/correction UI building block.
5. **The test video is tiny.** `testMedia/VID_20260613_210605.mp4.mp4`: 35 s, 360×640 portrait, H.264 + AAC 48 kHz, 2.1 MB. Storage limits are not a problem for the PoC.

## 2. Architecture map

- **Frontend:** Expo 58 / RN 0.88 / React 19, expo-router. Private stack in `app/(private)/AppContent.tsx`; dashboard tabs `your-roadmaps` and `add-video`. Video detail/player: `app/(private)/video-upload/[id].tsx`. Test workspace: `app/(private)/local-videos.tsx`.
- **Data access:** all via TanStack Query hooks in `lib/hooks/`; keys in `lib/queryKeys.ts`. Segment CRUD: `lib/hooks/useSegments.ts` (`useVideoSegments`, `useCreateVideoSegment`, `useUpdateVideoSegment`, `useDeleteVideoSegment`).
- **Backend:** Supabase (project `qvdacsdsxkrzceawchng`): Postgres + Auth + one Edge Function. SQL applied by hand from `sql/bootstrap` and `sql/migrations`. No Supabase CLI config in repo; CLI not installed locally. Tooling absent locally: ffmpeg, ffprobe (python3 3.9 present).
- **Auth/RLS:** owner-only (`auth.uid() = user_id`) on `video_uploads`, `segments`, `user_roadmaps`, `video_categories`; segments insert/update also require the category's roadmap to match the upload's roadmap. `service_role` has full grants. No admin concept remains. Subscription gating is UI + `has_active_subscription()` RPC; not applied to uploads/segments.
- **Notifications:** in-app snackbar only. No push, no Realtime usage. Existing "wait for server" pattern is polling (`home.tsx` after purchase).
- **Observability:** `lib/observability.ts` → `client_error_logs` table; console logging otherwise.
- **CI:** typecheck + Jest (`lib/**/*.test.ts` only) + Android release smoke. No Edge Function or SQL deploy step.

### Key schema (post-migrations)

`video_uploads`: id, user_id, roadmap_id, local_reference_key, platform, media_identifier, fallback_uri, name, filename, original_filename, content_hash, custom_title, duration_seconds, mime_type, file_size_bytes, width, height, creation_time, thumbnail_reference, status (AVAILABLE/MISSING/ACCESS_DENIED/UNKNOWN), replacement_review_pending, timestamps. Unique (user_id, local_reference_key).

`segments`: id, user_id, video_upload_id, sequence, start_time, end_time, count_start, count_end, category_id (NOT NULL), title, thumbnail_reference, user_notes, ai_confidence (0–1), ai_generated, user_confirmed, timestamps. Check start_time ≥ 0 and < end_time.

`video_categories`: id, user_id (null for system), roadmap_id, name, description, system_category. Unique (roadmap_id, lower(name)). Non-system rows cannot be named "Misc".

## 3. How the feature should fit

- **Position library → `video_categories`.** Positions (basic, basic sensual, basic left over right, shadow back to back) map naturally to categories in the user's roadmap; `Misc` is already the system fallback. Descriptions and reference images would need new columns or a side table (`position_definitions`), to be decided in Prompt 3.
- **Snippets → `segments`** with `ai_generated=true`, `user_confirmed=false`, `ai_confidence` set, `count_start=1`. Existing edit/delete/relabel flows then work unchanged. Reviewing = flipping `user_confirmed`.
- **Intermediate results (beat grid, count-1 list, per-cycle predictions, frames) → new tables** keyed by a processing run, so snippets can be regenerated from stored predictions without re-running AI, and corrections are preserved (spec 7.1/7.2).
- **Trigger UX:** a button on the video detail page enqueues a job row; a worker (user has approved a separate worker) processes it; the app polls or subscribes via Supabase Realtime; snackbar on completion.

## 4. The storage question (spec Prompt 1 addendum)

The real gap is not an upload-size limit; it is that **no upload path exists at all**. Server-side processing requires the file to reach the worker. Options:

| Option | Fit | Notes |
|---|---|---|
| A. Upload to Supabase Storage, worker downloads, optionally deletes after processing | Smallest change | Free tier: 50 MB per file, 1 GB total; Pro ($25/mo): 100 GB included, per-file limit configurable up to 50 GB. Figures from Supabase pricing docs, **not verified against the live project** (MCP had no access token). Phone demo clips at 360p–1080p are typically 2–60 MB/min. |
| B. Cloudflare R2 or similar | Only if files are large or storage must persist cheaply | Adds a second provider, signed-URL plumbing and egress rules. Not justified by a 2 MB test file. |
| C. Replace backend | No | Nothing demonstrated requires it. |

**Recommendation:** Option A for the PoC and likely production, with "upload for processing, keep only derived data" to respect the existing privacy promise and keep storage cost near zero. Whether originals stay in Storage is a product decision for Prompt 3.

## 5. Risks and limitations

- **Privacy promise change.** App copy and FEATURES.md state videos are never uploaded. Server processing changes this; needs user-facing copy, and a privacy-policy update before store release.
- **Bootstrap SQL is corrupted.** `sql/bootstrap/01_tables.sql` lines 1–25 are a stray diff fragment with `+` prefixes; the real `video_uploads` definition below lacks `original_filename`/`content_hash`, and `video_upload_notes` is missing from bootstrap entirely. A fresh bootstrap would fail. Pre-existing; not touched.
- **Migration idempotency bug.** `20260808_create_video_segments_categories.sql` policy-existence checks test `tablename` instead of `policyname`, so re-running fails.
- **No ffmpeg or Python audio stack locally**, no Supabase CLI. The worker needs its own runtime (Python + ffmpeg is the obvious choice for beat detection).
- **Edge Functions cannot do this work**: CPU/time limits, no ffmpeg. The worker must be a separate process (approved).
- **Notifications** limited to in-app; push would add a dependency and a native rebuild.
- **`has_active_subscription(p_user_id)`** is callable for any user id by authenticated users (minor info leak). New RLS should use `auth.uid()`.
- **Segment stop accuracy** is ~0.1 s due to the timeUpdate interval; fine for review, worth knowing for boundary evaluation.
- **Query-key bug:** `useUpsertVideoUploadNote` invalidates a non-matching roadmap key (pre-existing, unrelated).

## 6. Reusable components

`segments` + CRUD hooks, `video_categories` (+ Misc), `LocalSegmentPlayer` (range playback + trim handles), `video-upload/[id].tsx` detail screen, `videoHash` (dedupe uploads by content hash), snackbar, `useEntitlement`, observability helper, Edge Function pattern that imports shared pure logic from `lib/` for Jest coverage.

## 7. Open questions for the user

1. May the app upload the video to Supabase Storage for processing, and should the original be deleted after processing (derived data only) or retained?
2. Where should the worker run for the PoC: your Mac (simplest, free) or a small cloud VM/container?
3. Should positions be per-roadmap categories (current model) or a global library shared across roadmaps?

## 8. Next step

Prompt 2: research beat/downbeat/8-count detection, spoken-count recognition, frame extraction and low-cost position classification, constrained by the £5/month price point. No implementation.
