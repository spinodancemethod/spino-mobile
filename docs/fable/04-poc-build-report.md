# Fable — Prompt 4 report: single-video proof of concept built and run

Date: 2026-10-31. Code: `worker/`. Run output: `runs/dry/` (git-ignored). Open `runs/dry/report.html` to review.

## 1. Status

| Stage | State | Evidence |
|---|---|---|
| Docker image (arm64, CPU) | Implemented, builds | `fable-poc:latest`, 4.6 GB, models pre-fetched |
| Probe + audio extract | Tested successfully | ffprobe/ffmpeg |
| Beat grid (Beat This!) | Implemented, **not meaningfully tested** | test clip has no music; tracker followed the voice at 74 BPM |
| 8-count phase from spoken counts | Tested successfully on this clip | 6 count-1 boundaries, 5 of 6 within the instructor's spoken cycle |
| Frame extraction | Tested successfully | 17 frames, 3 per boundary (2 for the partial first cycle) |
| Pose features (RTMPose) | Implemented, partially working | finds both dancers; rule label wrong on 1 of 6 cycles, weak as a voter |
| Classification (Claude Haiku 5.5 + Sonnet 5.5 escalation) | Tested successfully | 17 Haiku calls, 4 escalations, structured JSON every time |
| Merge → snippets | Tested (unit + run) | 3 snippets |
| HTML report | Tested | plays snippets, lists every intermediate |
| Unit tests | 19 pass | `docker compose run --rm --entrypoint pytest fable -q` |

Wall clock for the 35 s clip: about 70 s on CPU (phase 15 s, pose 7 s, classify 41 s, rhythm 4 s).

## 2. Results on the test video

Count-1 boundaries (s): 0.00 (partial cycle), 5.11, 11.61, 17.60, 23.23, 30.08. The instructor counts a cappella at ~0.8 s per count and finishes with a faster "1 2 3 4"; the last boundary is taken from the spoken "one" itself.

| Cycle | t | Label | Agreement | Review | What the frame actually shows (my reading) |
|---|---|---|---|---|---|
| 0 | 0.00 | basic | 1.00 | no | open two-hand hold, facing |
| 1 | 5.11 | shadow_back_to_back | 0.92 | no | clearly back to back |
| 2 | 11.61 | unknown | 0.62 | yes | leader behind follower, arms crossed in front: a wrap / cuddle. Not in the active vocabulary |
| 3 | 17.60 | unknown | 0.59 | yes | same wrap family, follower tilted |
| 4 | 23.23 | unknown | 0.55 | yes | follower in front, leader's hand on her waist: back-to-chest / side wrap. Not in vocabulary |
| 5 | 30.08 | unknown | 0.40 | yes | facing, two-hand hold with space: should be basic. **Conservative miss** |

Snippets: basic 0.00–5.11, back-to-back 5.11–11.61, unknown 11.61–35.07 (needs review).

Reading: on the four-class vocabulary the model got 2 of 2 in-vocabulary cycles right with high agreement, correctly refused 3 cycles whose positions are outside the vocabulary, and under-called 1 cycle as unknown. It never invented a label. The evidence strings are specific and mostly accurate ("leader stands behind the follower, arms wrapped across her chest"). **These are my readings of the frames, not ground truth; the user must label the six cycles.**

## 3. Cost

| | Calls | USD |
|---|---|---|
| Haiku 5.5 per-frame | 17 | 0.0027 |
| Sonnet 5.5 escalations | 4 | 0.0189 |
| Total | 21 | **0.0216** |

Prompt caching worked from the first call (1,027 cached tokens read per frame). Escalations are 87% of the cost; for a 2-minute video with many uncertain cycles this would be ~$0.10. Options for Prompt 5: escalate to Haiku with all three frames instead of Sonnet, or only escalate when agreement is between 0.5 and 0.75.

## 4. Defects found and fixed during the build

1. Whisper's compression-ratio hallucination filter rejected every real counting segment (repetitive counting compresses well). Now skipped for digit-dense segments.
2. Whisper collapsed a repeated 8-count in a 12 s segment and lost a cycle. Transcription now runs in 6 s windows, 5 s hop, with duplicate words merged.
3. Grouping digits by sequence shattered on dropped or duplicated words. Replaced by clustering on each digit's implied count-1 time.
4. A tempo clamp overrode a clearly spoken "one" at the fast finish. A high-confidence "one" now anchors its cycle.
5. Claude responses occasionally exhausted a 300-token cap during thinking and returned no text. Cap raised to 1024, effort set to low, fallback hardened.
6. Compose `environment:` overrode the env file with an empty host variable, silently running without the API. Removed.

## 5. Known limitations and open questions

- **Music path untested.** Every rhythm result above comes from voice-only audio. A clip with music is required before any claim about Beat This! on Bachata.
- **Vocabulary mismatch is the main source of "unknown".** The user's position document lists 15 positions; the clip uses at least Cuddle/Wrap and Back-to-Chest. All 15 are in `positions.json` with `active:false`; activating them is a one-line change per position. Decision for the user.
- **Pose rule is weak** (wrong on the back-to-back cycle). It is a 0.3–0.5-weight voter only; the VLM dominates. Worth keeping for the hand box and cheap de-duplication, not as a classifier.
- **Reference images not yet used.** The system prompt supports them; none supplied.
- **Snippet boundary offsets** (lead-in) untested; default 0.
- **Partial first cycle**: the clip starts on count ~2.5; the first snippet runs from 0 s and is labelled from 2 frames.

## 6. User review of this run (2026-10-31) and resulting changes

Ground truth saved in `docs/fable/labels/VID_20260613_210605.json`.
- Count-1 times: "spot on".
- Cycle 0 basic, cycle 1 back-to-back, cycle 5 basic: correct. Cycles 2–4: position not clear; **rule: an unclear cycle merges into the preceding snippet**. The feature should segment on the most common position points, not every variation.
- All 15 positions from the user's document are now active for the Bachata roadmap.

Applied: `merge.py` now extends the previous snippet over unknown cycles (leading unknowns join the first known label); 21 unit tests pass. Re-merging the existing predictions gives `basic 0.00–5.11`, `back_to_back 5.11–35.07 (absorbs 2,3,4,5)`. The expected answer has a third snippet `basic 30.08–35.07`; the gap is the cycle-5 classification miss recorded above, to be addressed in Prompt 5 (now that `basic` competes with 14 other labels rather than 3, this must be re-measured).

Document updates: safe as long as position `id`s stay stable; names, descriptions and cues can change freely and only affect the prompt. Adding a position is a new entry; removing one is `active:false`.

**2026-11-01: user refined the list** (`testPositionsDoc/bachata_position_reference.md`, 16 rows, three-part attribute Body Arrangement | Partner Order | Arm/Hand Connection). `positions.json` now has 16 active ids and 8 retired (`active:false`): `handshake` → LL/RR, `hammerlock` → leader/follower × left/right, `side_by_side` → leader left/right, `wrap`/`sweetheart` → `cuddle`, `side_wrap`/`back_to_chest`/`promenade` dropped. Ids used in the saved labels (`basic`, `shadow_back_to_back`) are unchanged. Reference-photo folders: `worker/positions/images/<id>/`, auto-discovered by the classifier (max 3 per position, downscaled to 768 px).

**Later on 2026-11-01 the user condensed the list for simplicity:** mirror pairs are folded into family ids, giving 10 active positions: basic_sensual, basic, cross_hand, handshake, shadow, reverse_shadow, cuddle, side_by_side, shadow_back_to_back, hammerlock. The side-specific ids remain in `positions.json` as inactive children (`parent_id`) so they can be re-enabled by flipping flags. Decisions for Prompt 7: positions become DB records (the app resolves the worker's slug to a row); users can add custom position categories that the AI will not recognise but can be selected manually. Reference photos deferred; Prompt 5 proceeds on descriptions alone.

Original caveat (now mostly moot): several of the 16 classes were mirror pairs (L/R cross-hand, LL/RR handshake, four hammerlocks, two side-by-sides) that differ only by which hand or arm is involved. From a single 360p frame these are hard to separate, and videos are often mirrored by the recording app. Expect more split votes and escalations until reference photos exist; it may be worth classifying to the family first and the side second.

## 7. Before Prompt 5

1. Open `runs/dry/report.html` and, for each of the 6 cycles, write the true position (any of the 15 names) and whether the count-1 time looks right. A short list in reply is enough.
2. Decide which positions to activate for this roadmap.
3. Optionally supply reference photos into `worker/positions/images/` and list them in `positions.json`.
