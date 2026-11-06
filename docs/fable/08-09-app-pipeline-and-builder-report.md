# Fable v2 — Prompts 8 and 9 report: analysis pipeline in the app, snippet builder

Date: 2026-11-02. Spec: `Fable_Master_Spec_v2.md` §4–6. Typecheck clean; Jest 61 pass (1 pre-existing failure in `lib/authUrl.test.ts`, unrelated).

## Prompt 8 — analysis pipeline

| Piece | File | State |
|---|---|---|
| Schema: analysis columns on `video_uploads`, `analysis_jobs`, private bucket `analysis-audio`, RPCs `queue_analysis_job` / `claim_analysis_job` / `finish_analysis_job` | `sql/migrations/20261101_create_analysis_jobs.sql` (+ bootstrap files) | **written, not applied** — Supabase access token invalid; needs a new token or the SQL pasted into the dashboard |
| Worker job loop (poll → download audio → analyse → write grid → delete audio) | `worker/fable/worker.py`, compose service `worker` | built; dry poll reaches the project and 404s on the RPC until the migration runs |
| On-device audio extraction (iOS AVAssetExportSession → m4a; Android MediaExtractor+MediaMuxer) | `modules/audio-extract/` | written; **needs a dev-client rebuild and a device test** |
| App: extract → upload `<user>/<id>.m4a` → RPC; status polling; labels | `lib/hooks/useVideoAnalysis.ts`, `lib/analysis/audioExtract.ts` | typechecks |
| UI: "Find counts" / "Re-analyse counts" and a Counts status line per video | `app/(private)/local-videos.tsx` | typechecks |

Privacy contract honoured: only the audio file is uploaded; the worker deletes it in a `finally`; users have insert-only access to their own folder in the bucket and cannot read or list it.

## Prompt 9 — snippet builder

`app/(private)/snippet-builder/[id].tsx`, reached from Local videos → **Build snippets** once counts are ready.

- Chunking is a pure function (`lib/analysis/chunks.ts`, 6 tests) mirroring the worker's reference implementation: 8-count chunks by default, 4 for fine-tuning; chunks never straddle a detected 8-count; lead-in and tail are chunks too; chunks that are mostly talking are marked and shown lighter but remain selectable (user decision).
- Thumbnails are generated on the phone from the local file, one per chunk, lazily.
- Selection: tap first chunk, tap last; third tap restarts. Edges nudge by one count (snapped to the beat grid).
- Save sheet: category chips from the roadmap's categories, inline "new category", optional title, Save. Snackbar with Undo. After saving, the next unsaved chunk is pre-selected and scrolled into view.
- Saved snippets list with delete; saved chunks shown as "saved" on the strip (overlap > 50%).
- Music mode: banner "Which chunk starts on a 1?" → select → **This is 1**; the phase is written back to `count_grid` so the question is asked once per video.
- Portrait only. No typing required to make a snippet.

Not done yet: haptics (no `expo-haptics` dependency; add in Prompt 11 if wanted), drag-to-extend (tap-tap covers it), pinch zoom.

## What the user must do before this can be tried on a phone

1. Create a new Supabase access token and run `claude mcp add supabase -s user -e SUPABASE_ACCESS_TOKEN=<token> -- npx -y @supabase/mcp-server-supabase@latest`, then restart Claude Code — or paste `sql/migrations/20261101_create_analysis_jobs.sql` into the SQL editor.
2. Rebuild the dev client so the `audio-extract` module is included: `npx expo run:ios` (or `run:android`).
3. Start the worker on the Mac: `cd worker && docker compose up -d worker`.
Then: Local videos → Find counts → wait for "Ready" → Build snippets.
