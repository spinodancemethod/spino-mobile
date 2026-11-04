# Fable Master Spec v2 — Count-guided snippet builder

Status: draft for approval, 2026-11-01. Supersedes `Fable_Master_Spec_Amended.md` (v1) for Prompts 7 onward. v1 Prompts 0–6 and their reports in `docs/fable/` stand as the record of what was tried and why.

## 0. Why v2

v1 asked the machine to do two things: find the 8-counts, and name the starting position of each. Six stages of work showed that the first is reliable and cheap, and the second is not:

- Beat and bar detection is accurate to a few milliseconds on music. Count-1 detection from spoken counting survives real class recordings with pauses, talking and tempo changes (`docs/fable/06-validation-report.md` §3).
- Position recognition from a frame was right roughly two times in three on real class footage, regardless of frame timing, model size or resolution (§7). Fixing it needs reference photos per position and more compute per video, which conflicts with the £5/month price point.

v2 keeps the reliable part and gives the judgement to the dancer. The machine finds every count; the user decides what each run of counts is and files it. No image recognition. No per-video API spend.

## 1. Product idea in one paragraph

The user records or imports class videos and demos. Each video stays on the phone. The app analyses only the audio, finds the beat grid and the count-1 positions, and cuts the video into **micro-snippets** of 4 counts (or 8, or a custom length). The user scrubs through the micro-snippets, selects a run of them, names it (position / move / category, from their roadmap or their own list), and saves it as a **snippet**. Snippets then feed the existing roadmap, practice and completion features unchanged.

## 2. Non-negotiables carried from v1

- Video never leaves the phone. Only the extracted audio track (16 kHz mono, ~1 MB per minute) is uploaded for analysis and deleted after processing.
- Cost: no LLM or vision API in the per-video path. Audio analysis runs on a small worker; target < £0.002 per video in compute.
- Per-roadmap vocabularies (Bachata, Salsa) remain the default categories; users may add custom categories.
- Videos up to 3 minutes. Modes: spoken counting, or music, never both.
- Everything the machine produces is editable by the user, and reprocessing never overwrites user edits.

## 3. What the machine does (worker, reused from v1)

Input: audio file + duration. Output: a **count grid**.

```
{
  "mode": "counting" | "music" | "none",
  "confidence": 0.0-1.0,
  "count_period_s": 0.56,               // seconds per count
  "count1_times": [0.0, 4.83, 9.39, ...],// start of each detected 8-count (counting mode)
  "bar_times":    [0.0, 2.4, 4.83, ...], // every 4 counts (both modes)
  "beat_times":   [...],                 // every count (music mode: from the grid; counting mode: interpolated)
  "speech_spans": [[25.5, 30.4], ...],   // instructor talking, not counting (counting mode)
  "ambiguous_1_vs_5": true | false       // music mode: which bar is "1" is a guess
}
```

- **Counting mode**: Whisper digit detection with the v1 fixes (structural rescue, no interpolation across talk, spoken "one" anchors). Each detected 8-count becomes two 4-count bars; counts within a bar are evenly spaced.
- **Music mode**: Beat This! grid; bars every 4 beats; `count1_times` is a guess (first downbeat), flagged ambiguous. The user fixes the phase with one tap (§5.4).
- **No usable audio**: `mode: none`; the app offers fixed-length chunks (e.g. 2 s) or manual cutting.
- Dropped from v1: frame extraction, pose, classification, merge, report. `worker/fable/{rhythm,phase,media}.py` are kept; `{frames,pose,classify,merge,report}.py` are retired.
- Processing time: ~0.5× real time on one CPU core (Whisper dominates). A 2-minute video returns in about a minute.

## 4. Data model

Existing tables are reused. Additions in **bold**.

- `video_uploads` (existing; device-local reference): add **`analysis_status`** (`none | queued | processing | ready | failed`), **`analysis_mode`**, **`count_grid jsonb`** (the §3 object), **`analysed_at`**. The audio is not stored.
- `segments` (existing): unchanged shape. `start_time`/`end_time` come from the selected micro-snippets. `category_id` is the user's choice. `ai_generated=false`, `user_confirmed=true` for everything the user saves; the AI columns stay for a future assist.
- `video_categories` (existing): per-roadmap system categories seeded from the position list (`worker/positions/positions.json` ids become system rows) plus user custom categories. This is the "position library" of v1 Prompt 8, used as labels only.
- **`analysis_jobs`**: `id, user_id, video_upload_id, status, error, created_at, started_at, finished_at`; the worker polls this. Audio goes to a private storage bucket keyed by job id with a 24 h lifecycle rule and is deleted on completion.

## 5. UI — the core of v2

Design goal: a user should turn a 1-minute class video into 3–6 saved snippets in under two minutes, one-handed, without typing times. Everything is tap and drag; numbers are shown, never typed, unless the user opens the precise editor.

### 5.1 Library ("Videos" tab, extends `local-videos.tsx`)

One list of all imported videos: thumbnail, duration, date, analysis status chip (`Not analysed` · `Analysing…` · `Ready` · `Needs a tap` for ambiguous music · `No audio`), and count of saved snippets. Actions: **Analyse** (uploads audio only; progress shown inline; notification when ready), **Open**. Multi-select to analyse several at once.

### 5.2 Snippet builder (new screen, replaces the manual time-entry flow in `video-upload/[id].tsx` for analysed videos)

```
┌──────────────────────────────────────────┐
│ ‹ Back      Class 12 Mar · 0:49           │
│ ┌──────────────────────────────────────┐ │
│ │                                      │ │
│ │            VIDEO (LocalSegmentPlayer)│ │   plays the selected range in a loop
│ │                                      │ │
│ └──────────────────────────────────────┘ │
│ ▶ ⟲  0.5× 1×        12.4 s  bar 4 of 24  │
│                                          │
│ Chunk:  4 counts [ 8 counts ] custom     │   segmented control (default 8; 4 for fine-tuning)
│                                          │
│  1   5   1   5   1   5   1   5   1   5   │   count label above each chunk
│ ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐ │
│ │▒▒│▒▒│██│██│██│  │  │  │  │  │  │  │  │ │   filmstrip of chunk thumbnails
│ └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘ │   ▒ = already saved, █ = current selection
│  ◀ drag ▶                                │   horizontal scroll; pinch to zoom
│ ░░░ talking ░░░                          │   grey band under chunks in speech spans
│                                          │
│ Selected: bars 3–5 · 10.0 s – 16.4 s     │
│ ┌─────────────────────┐ ┌──────────────┐ │
│ │ Category: Basic  ▾  │ │ Save snippet │ │
│ └─────────────────────┘ └──────────────┘ │
│ Saved (2): Basic 0–10 · Cross-hand 16–21 │   tappable list, edit/delete
└──────────────────────────────────────────┘
```

Interactions:
- **Tap a chunk** selects it and plays it in a loop. **Tap another chunk** extends the selection to a range (first tap = start, second = end; a third tap starts over). **Long-press and drag** also extends.
- **Drag a range edge** moves the boundary by one count at a time (snapping to `beat_times`), for the cases where the move starts on 5 or ends early. Haptic tick per count.
- **Chunk size** control re-cuts the filmstrip instantly from the same grid; selection is preserved where possible.
- **Count labels** show `1` / `5` (counting mode) or `1`/`5` greyed with a "tap to set 1" hint (ambiguous music mode).
- **Talking spans** are lightly shaded for orientation only; they are ordinary chunks, selectable and included in snippets like any other (user decision: the explanation is part of the snippet).
- **Save snippet** opens a compact sheet: category (recent at top, roadmap positions, then custom, "+ new"), optional title, thumbnail = first frame of the range (editable). Saving marks the chunks ▒ and advances the selection to the next unsaved chunk so the user can keep going without scrolling.
- **Saved list** at the bottom: tap to re-select its range, swipe to delete, edit category inline.
- **Undo** (toast) after save/delete.
- **Precise editor** (existing modal in `[id].tsx`) remains reachable from a saved snippet for typed times.

Keyboard/typing is never required to make a snippet.

### 5.3 Playback details
- Selected range loops by default; play head shown on the filmstrip.
- Speed 0.5× / 0.75× / 1× for checking footwork.
- Audio on by default in counting mode (hearing "1" matters), muted by default in music mode.
- Chunk thumbnails are generated on the phone from the local file (expo-video / expo-av frame grab) at the chunk's first count, cached per video.

### 5.4 Music mode phase fix ("Needs a tap")
Banner: "Which chunk is a 1?" The filmstrip shows bars without 1/5 labels. The user taps the chunk that starts on count 1 (optionally while it plays); labels appear and the grid is saved on the video. One tap, once per video. If the user doesn't care, everything still works with unlabelled bars.

### 5.5 Edge cases
- Video shorter than two bars, or no audio: filmstrip in fixed 2 s chunks, same interactions.
- Analysis failed: retry button; manual chunks meanwhile.
- Count-grid jitter (±0.1 s): irrelevant to the user, but all saved times come from the grid the user saw, so re-analysis never silently moves saved snippets (the old grid is kept on the video until the user chooses to replace it).
- Re-analysis: saved snippets stay; filmstrip is rebuilt; chunks overlapping saved snippets are shown ▒ by time overlap.

### 5.6 Accessibility and feel
- Minimum touch target 44 pt; chunk tiles ≥ 56 pt wide at default zoom.
- Haptics on selection and on each count while dragging.
- Portrait only, one-handed (user decision: no landscape mode).
- Dark/light via existing ThemeProvider.

## 6. Prompts (staged, with approval gates)

Approval required after Prompts 8, 10 and before 12, as in v1.

**Prompt 7 — Worker v2.** Strip the worker to audio-in / count-grid-out (§3). Keep tests. Add `speech_spans`, `beat_times`, bar interpolation. Validate on the five existing clips: count grids match the v1 verified boundaries within 0.25 s. Output: `docs/fable/07-worker-v2-report.md`.

**Prompt 8 — Analysis pipeline in the app.** Audio extraction on device (expo-av / ffmpeg-kit), upload to a private bucket, `analysis_jobs` row, worker polls and writes `count_grid` to `video_uploads`, deletes the audio, push/in-app notification. Statuses in the Library. Migration + bootstrap SQL + RLS. **Approval gate.**

**Prompt 9 — Snippet builder UI.** §5.2–5.6 in full, including chunk thumbnails, phase tap, save sheet, saved list, undo. Reuse `LocalSegmentPlayer`, `useSegments`, `video_categories`. Usability pass on the three class clips: target under two minutes per video for 3–6 snippets.

**Prompt 10 — Categories as position library.** Seed per-roadmap system categories from the position list; custom categories; ordering and recents in the save sheet. Remove dead v1 code paths. **Approval gate.**

**Prompt 11 — Hardening.** Error handling, job retries, duplicate-job protection, audio lifecycle verification, offline behaviour (builder works without network once analysed), analytics for time-to-first-snippet.

**Prompt 12 — Batch.** Analyse many videos in one go (queue, progress, limits). Only after 7–11 are approved and stable.

**Later (optional, not scheduled):** position suggestion as an assist, once the user has reference photos. It would pre-select a category in the save sheet, never create snippets on its own.

## 7. Success criteria

- A 1-minute class video is analysed in under 90 s and costs nothing in API spend.
- The user produces 3–6 correctly bounded snippets in under 2 minutes without typing a time.
- Count-1 boundaries are within a quarter count of the spoken "1" on counting clips; bar boundaries within 20 ms of the beat on music clips.
- No video bytes ever leave the device; audio is deleted within 24 h in all cases.

## 8. Open questions for the user

1. Default chunk size: 8 counts, 4 is for fine tuning. 
2. Should talking spans be hidden by default or just shaded? Talking spans should be part of the snippets. 
3. Should a saved snippet be allowed to overlap another (same footage filed under two categories)? YES
4. Landscape builder in v1 of the UI, or portrait only first? This is for mobile only, I dont want landscape. 
