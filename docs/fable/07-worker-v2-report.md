# Fable — Prompt 7 (v2) report: worker stripped to audio in, count grid out

Date: 2026-11-01. Spec: `Fable_Master_Spec_v2.md` §3, §6. Code: `worker/fable/{media,rhythm,phase,grid,analyse}.py`. v1 vision modules moved to `worker/legacy_v1/` (not built). Image `fable-poc:latest` rebuilt. 24 unit tests pass.

## 1. What changed

- New CLI `python -m fable.analyse --input <video|audio> --out <dir>`: probe → 16 kHz mono audio → Beat This! → spoken-count detection → `grid.json`. No frames, no vision, no API key.
- New `grid.py`: builds the §3 object (`mode`, `count_period_s`, `count1_times`, `bar_times`, `beat_times`, `speech_spans`, `ambiguous_1_vs_5`) and a reference `chunks(grid, 8|4)` implementation the app will mirror.
- Counting mode: 8 evenly spaced counts per detected 8-count; no counts are invented across a pause; `speech_spans` from transcript segments that are mostly words (≥ 1 s).
- Music mode: bars every 4 beats from the downbeat phase; `count1_times` is a guess and flagged; chunks align to bars with an unlabelled lead-in chunk.
- Accepts an audio-only upload (`.wav/.m4a/...`) so the phone never sends video.

## 2. Determinism fixes found while validating

1. **Whisper was nondeterministic.** The same clip gave 64 then 55 digits between runs; the default temperature fallback re-decodes hard windows by sampling. Now `temperature=0.0`. Same input → identical grid, verified twice on the 67 s clip.
2. **Without the fallback, Whisper loops** ("one six seven eight" × 30 in one 6 s window). Segments denser than 5 words/s are re-transcribed as two 3 s halves (deterministic, rarely loops); zero-length words are dropped. This recovered the two 8-counts at 46 and 50 s that the loop had swallowed.
3. A ~2-cycle gap is no longer filled with an interpolated cycle when the instructor is talking in it (was inventing a count 1 at 24.4 s inside "and move together, move, move").

## 3. Validation on the five clips

| Clip | Mode | 8-counts | Bars | Speech spans | Time |
|---|---|---|---|---|---|
| VID_20260613 (35 s, user-verified) | counting | 6 | 12 | – | 17 s |
| VID_20250125 (29 s) | counting | 5 | 10 | – | 15 s |
| VID_20250202 (67 s, talking at 25–30 s) | counting | 13 | 26 | 25.6–30.5 | 35 s |
| VID_20250312 (49 s, intro talk 5–10 s) | counting | 11 | 22 | 5.2–10.6 | 20 s |
| PXL_20240530 (140 s, music) | music, ambiguous | 31 (guess) | 61 | – | 38 s |

- Verified clip: count-1 deviations 0.00 / +0.17 / −0.15 / 0.00 / +0.07 / 0.00 s against the user's times (≤ a quarter count).
- VID_20250202: boundaries at 14.8, 19.5, 28.8, 37.4 s match the user's "15, 19, 30, 38". The talking stretch 19.5–28.8 is one long chunk, as the user wants (talking is part of the snippet).
- VID_20250312: the user's 10 s and 16 s starts are at 10.0 and 15.8; the intro (0–10 s) is marked as speech 5.2–10.6 so the app can shade it.
- Music clip: bars every 2.286 s; first bar at 1.73 s; which bar is "1" is left to the user's tap (the user said 4.0 s, i.e. the second bar).

Processing is ~0.5× real time on one CPU core, Whisper-bound. No per-video API cost.

## 4. Known limits (carry to Prompt 8/9)

- Count-1 jitter of ±0.15 s between clips' transcriptions is gone (deterministic), but a different recording of the same class would still differ slightly. Snippet times are taken from the grid the user saw, never recomputed.
- Clusters with two digits are accepted; occasional spurious 8-counts remain possible in noisy speech. In the UI they appear as an extra chunk boundary the user can ignore (merging chunks is a tap).
- Lead-in before the first spoken "one" is emitted as a partial first cycle starting at 0; the UI shows it as a chunk like any other.

## 5. Next: Prompt 8 — analysis pipeline in the app
On-device audio extraction, upload to a private bucket, `analysis_jobs` row, worker polls and writes `count_grid` to `video_uploads`, deletes the audio, notifies. Needs approval before starting (spec §6 gate).
