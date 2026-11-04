# Fable v2 — Prompts 10–12 report: position library, hardening, batch

Date: 2026-11-02. Typecheck clean; Jest 61 pass (1 pre-existing failure in `lib/authUrl.test.ts`). Worker image rebuilt.

## Prompt 10 — position library as categories
- `position_templates` table seeded from `worker/positions/positions.json` (10 active Bachata positions, stable slugs). Users can read it; only migrations write it.
- `apply_position_library(roadmap, style)` copies missing templates into the caller's roadmap as **user-owned** categories tagged `position_slug` (system categories have a global unique-name index, so they cannot be per-roadmap). Users can rename, reorder, delete, and add their own; the AI never needs to recognise them (user decision).
- UI: **Add Bachata positions** on every roadmap card (idempotent, reports how many were added). Builder chips show library positions first by `sort_order`, then custom categories by name.
- Migration: `sql/migrations/20261102_position_library.sql`.

## Prompt 11 — hardening
- `requeue_stale_analysis_jobs()`: jobs stuck in `processing` for 15 min go back to the queue; after 3 attempts they are failed and the video shows "Analysis failed" with a retry button.
- Worker maintenance every 10 min and at start: requeue stale jobs, sweep the `analysis-audio` bucket for objects older than 24 h (normal jobs delete their file in a `finally`; the sweep covers uploads whose job was never created or whose worker died mid-download).
- Duplicate-job protection: partial unique index on `analysis_jobs(video_upload_id)` for live jobs; the app maps the 23505 error to "already being analysed".
- Offline: the builder needs only the cached video row (`count_grid`) and the local file; saving a snippet needs the network, like every other write in the app.
- Size/length limits: 20 MB audio (bucket limit and worker check), 180 s video (app and worker).
- Migration: `sql/migrations/20261102_analysis_hardening.sql`.

## Prompt 12 — batch
- **Find counts for all** in Local videos queues every available, not-yet-ready video, sequentially (audio extraction is CPU-bound on the phone), with "Queuing i of n" progress. The worker drains the queue without sleeping between jobs. Per-video status chips show progress. ~35 s of worker time per minute of video, so 100 one-minute videos take about an hour on one core; a second worker container doubles that (jobs are claimed with `FOR UPDATE SKIP LOCKED`).

## To bring it up (in order)
1. Apply migrations: `20261101_create_analysis_jobs.sql` → `20261102_position_library.sql` → `20261102_analysis_hardening.sql` (SQL editor, or via MCP once a valid access token is configured).
2. Rebuild the dev client (`npx expo run:ios` / `run:android`) so `modules/audio-extract` is included.
3. `cd worker && docker compose up -d worker` on the Mac (or any host with Docker; it needs only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`).
4. In the app: roadmap → Add Bachata positions; Local videos → Find counts (or Find counts for all) → Build snippets.

## Not verified on a device
Everything above typechecks and the worker runs against the project (RPCs 404 until step 1), but no phone build has been made, so the native audio-extraction module and the builder's touch flow are untested in the hand. First device session should check: extraction works on an iOS Photos video (ph:// URI resolution), thumbnails appear, tap-tap selection, save, and the music-mode "This is 1" tap.
