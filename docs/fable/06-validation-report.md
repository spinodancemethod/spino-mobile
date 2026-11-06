# Fable — Prompt 6 report: validation on additional videos

Date: 2026-11-01. Runs: `runs/p6-<clip>/` (final), `runs/p6v1-<clip>/` (first pass, before the fixes below). Open `report.html` in each; the new **Verify boundaries** strip at the top plays 2 s from every detected count 1 / count 5.

## 1. Clips

| Clip | Length | Format | Audio mode | Bars scanned | Cost | Wall clock |
|---|---|---|---|---|---|---|
| VID_20250125_200347 | 29.5 s | 1080p H.264, 71 MB | voice counting | 10 | $0.012 | ~75 s |
| VID_20250202_124916 | 66.7 s | 1080p H.264, 167 MB | voice counting, with talking | 28 | $0.042 | ~4.5 min |
| VID_20250312_214144 | 48.7 s | 1080p H.264, 125 MB | voice counting, fast (~0.5 s/count) | 22 | $0.024 | ~2.5 min |
| PXL_20240530 (Prompt 5) | 140 s | 1080p HEVC, 347 MB | music only | 61 | $0.093 | ~6 min |

All three new clips are voice-counting; none has music. User confirms demos are always one or the other.

## 2. What generalised

- **Mode detection**: all three correctly took the spoken-counts path (the beat tracker locked onto the voice at 69–94 BPM and flagged itself out of range, as designed).
- **Pose and frame extraction at 1080p**: fine, 2–3× slower than 360p (pose ≈ 1.5 s/frame).
- **Classification**: labels are internally consistent (long unanimous runs of basic / basic_sensual / cuddle), cost per bar unchanged at ~$0.0015.
- **Merge rules from Prompt 5** (low-confidence bars cannot start a snippet; count-5 bars need 0.75): no fragmentation; 4–7 snippets per clip.

## 3. What did not generalise: count-1 detection on real class counting

The counting clip from Prompt 4 was a clean, continuous drill. Real class clips are not:

- The instructor **stops and talks** ("and move together, move, move"), then restarts, often from "five six seven eight" or "one two three go".
- **Tempo varies** cycle to cycle (clip 2: cycle lengths 3.3–5.5 s).
- Whisper rejects many digits on **per-word probability** (37 of 84 on clip 2) although they sit exactly where the sequence predicts.

The first pass handled this badly: it snapped boundaries to the bogus voice-derived beat grid (6 snaps on clip 3), interpolated boundaries across talking gaps with a constant cycle length, and extended the grid to the end of the clip. A per-cycle check (how well the spoken digits fit each proposed count 1) flagged 11 of 15 cycles on clip 2 and 8 of 11 on clip 3.

### Fixes (phase.py)
1. **No snapping to the beat grid on counting clips.** Modes are exclusive, so the grid is irrelevant once counting is detected.
2. **No interpolation across gaps, no extension past the last detected cycle.** A missing cycle is interpolated only when a gap is ~2 cycles wide (words were missed). Pauses simply produce no boundary; the snippet continues.
3. **Structural rescue of low-probability digits**: a rejected digit is accepted when an accepted neighbour (value ±1 or ±2) sits the right number of counts away (±45%). Rescued: 6 / 17 / 13 digits on the three clips, 15 on the Prompt 4 clip.
4. Spoken-"one" anchor threshold relaxed from 0.8 to 0.6 probability.

### Effect
- **Regression on the Prompt 4 clip**: boundaries 0.00 / 5.28 / 11.52 / 17.60 / 23.30 / 30.08 vs user-verified 0 / 5.11 / 11.61 / 17.60 / 23.23 / 30.08. Max deviation 0.17 s (a quarter count). Fine.
- Clip 2: the 19.5–28.8 s talking stretch now has no boundaries; the restart at 28.8 s ("one, two, three") and at 31.6 s are detected; two spurious boundaries removed; 15 → 14 cycles.
- Clip 3: first boundary moved 4.66 → 4.45 s (the spoken "one"), 10.73 → 10.03, 16.43 → 15.78; the cross-hand snippet moved from 10.7–18.8 to 15.8–21.4 accordingly. **This is the biggest change and needs the user's ear.**
- Clip 1: boundaries within 0.25 s of the first pass; snippets unchanged.

### Snippets (final)

VID_20250125_200347: basic 0–5.2 · cuddle 5.2–17.2 · basic_sensual 17.2–25.3 · shadow 25.3–29.5

VID_20250202_124916: basic 0–14.0 · basic_sensual 14.0–30.2 · basic 30.2–41.5 · basic_sensual 41.5–49.8 · basic 49.8–66.7 (23 of 28 bars flagged for review — see §4)

VID_20250312_214144: basic 0–15.8 · cross_hand 15.8–21.4 · basic_sensual 21.4–29.2 · basic 29.2–32.8 · handshake 32.8–34.8 · basic 34.8–40.4 · basic_sensual 40.4–48.7

## 4. Open issues

1. **Ground truth.** I cannot hear the clips. The per-cycle digit fit still flags several cycles (clip 2: cycles at 9.4, 19.5, 28.8, 31.6 s; clip 3: 0, 15.8, 21.4, 29.2 s). The user should press the Verify buttons in the three reports and say which boundaries are off and roughly which position each snippet shows.
2. **Clip 2 is low-confidence throughout** (23 of 28 bars flagged; many bars 0.2–0.6). Checked the frames: it is a class demo with ~10 spectators standing and sitting around the couple, both dancers in black, leader's back to the camera for much of it. Two consequences: the pose step ("two largest skeletons") sometimes picks a spectator, so the hand crop can be wrong; and the model has to find the couple among many people. Fix for Prompt 7/8: pick the two people closest to the frame centre with the most inter-person overlap, and crop the API frame to the couple's bounding box (plus margin) before sending. This is the most realistic clip of the set, so this matters.
3. **Cycle length varies 3.3–6.8 s** within one clip. Count-5 midpoints are therefore approximate (±0.3 s); acceptable for a 0.2–0.4 s frame window, but worth deriving count 5 from the spoken "five" when present.
4. **Processing time** at 1080p: ~4 min per minute of video on this Mac. Pose dominates. For Prompt 7 either downscale frames for pose (720p is plenty) or run pose only on the first frame of each bar.
5. Whisper run-to-run jitter (±0.1–0.2 s) remains; irrelevant for snippets, relevant for exact A/B comparisons.

## 5. Recommendation (superseded by §6)

The approach generalises with the four phase fixes; nothing in the stack needs replacing.

## 6. Simplification (user decision, same day)

The user judged the pipeline over-complex and over-expensive, and set the target: detect count 1, take one frame there, match it to a position, and when in doubt merge into the previous snippet. Classes have at most six 8-counts. Output is only timestamps + position id for a video on the phone.

**Removed:** RTMPose (half the compute), bar-level scanning, three-frame voting with extra rounds, Sonnet escalation, the diagnostic report. **Kept:** Beat This! (music detection), Whisper digit detection with the §3 fixes, one Haiku call per 8-count (a second frame only when the first is unknown/low), the merge rules. **Music-only clips:** one snippet, `basic`, confidence 0.1, flagged, for the user to split; revisit later. The report now shows one thumbnail per 8-count and the snippet list.

### Results, final configuration (`runs/s2-*`, `runs/s-*`)

| Clip | 8-counts | Snippets | Cost | Total time |
|---|---|---|---|---|
| Prompt 4 clip (35 s, 360p) | 6 | 3–4 (see below) | $0.001 | 25 s |
| VID_20250125 (29 s) | 5 | 3 | $0.001 | 21 s |
| VID_20250202 (67 s, spectators) | 13 | 4 | $0.005 | 71 s |
| VID_20250312 (49 s) | 11 | 5 | $0.003 | 36 s |
| Music clip (140 s) | – | 1 (`basic`, flagged) | $0 | 46 s |

Cost fell ~10× and time ~5× against the Prompt 5 configuration. Time is now dominated by Whisper (~0.4× real time) and ffmpeg.

**Frame position test.** The user expected the frame before count 1 (end of 8). Both were run on all clips. On the ground-truth clip, the frame *at* count 1 gave the four expected snippets; the frame one beat before misread back-to-back as cuddle and the final basic as shadow. On the other clips the beat-before frame produced more second-frame fallbacks (7 vs 5, 4 vs 1) and more label churn. Default stays at count 1; `--offsets-counts -1` remains available.

**Single-frame fragility, stated plainly.** With one frame there is no vote, so a misread becomes a wrong or missing snippet. On the ground-truth clip the back-to-back 8-count was read correctly in 5 of 7 runs today; in the other 2 it came back as cuddle (medium) and was absorbed into the neighbouring snippet, giving 3 snippets instead of 4. This is the accepted trade-off: the user fixes it in the review screen.

**Confidence semantics for the app.** A snippet confidence of 0.7 means a clean medium-confidence read; 1.0 a high one; below 0.5 the cycle was absorbed. `needs_review` is set when a snippet contains any cycle below 0.6.

## 7. User review of the simplified runs: not correct

User (2026-11-01): VID_20250125 — a basic starts ~23 s, not detected. VID_20250202 — basic at 15 s, cuddle at 19 s, basic at 30 s, then the same sequence again from 38 s from another angle; second angle labelled differently. VID_20250312 — basic at 10 s and 16 s, repeat at 28 s. "I don't think the snippets are being detected well."

### Diagnosis from contact sheets (`runs/sheets/`)
- **Timing.** In both class clips the dancers are still finishing the previous turn on count 1 and settle into the hold 1–2 s later (count 3–4). The Prompt 4 clip had them in position on 1, which misled the offset choice.
- **Lead-in.** VID_20250312 starts with ~10 s of the instructor talking while holding hands; the first snippet was wrongly labelled `basic` from 0 s.
- **Vocabulary.** 22 s in VID_20250125: close frame, model says `basic_sensual`, user says basic. Basic vs close hold is a definitional question for the user.
- **Boundaries themselves were right** (15.1, 19.6, 28.8, 38.0 s on VID_20250202 match the user's 15/19/30/38).

### Experiments (per-cycle labels in `runs/o3-*`, `strip-*`, `sonnet-*`, `hires-*`)
| Strategy | Cost / clip | VID_20250202 (user: 15 basic, 19 cuddle, 30 basic, 38 repeat) |
|---|---|---|
| 1 frame at count 1 (s2) | $0.005 | 15 cross_hand 0.2, 19 close 0.2, 29 basic, 46 unknown, 54 cuddle |
| 1 frame at count 4 (o3) | $0.005 | 15 **basic**, 19 basic 0.2, 29 basic, 46 cross 0.2, 54 basic |
| 3-frame strip (1, 2.5, 4) one call (strip) | $0.007 | 15 cross 0.2, 19 cross 0.2, 29 basic, 46 handshake 0.2, 50 hammerlock |
| strip, Sonnet 5.5 | $0.079 | 15 **basic**, 19 close, 29 basic, 38 handshake, 46 unknown |
| strip, Haiku, 1568 px | $0.014 | 15 close, 19 close 0.2, 29 basic, 46 cuddle 0.4, 54 basic |

No strategy is reliable on this clip, and the second angle (38 s on) never reproduces the first-angle labels. Sonnet and higher resolution do not help, so neither model size nor pixels is the bottleneck. The hard cases are all hold distinctions (basic / close / handshake / cross-hand) in a crowded hall with both dancers in black, plus the cuddle at 19 s where the leader's back hides the follower.

### Conclusion
Count-1 detection is now adequate on these clips. **Visual position classification from descriptions alone is not reliable enough on real class footage** (roughly 60–70% per 8-count on the crowded clip, better on the cleaner ones). Levers, in order of expected impact: (1) reference photos of each position from the user's own classes (the vocabulary is the user's, not a public standard); (2) a smaller first-release vocabulary of visually distinct positions; (3) cropping to the couple before classification; (4) accept and rely on user correction. Decisions needed from the user: snippet granularity (one per demonstrated 8-count vs merged), basic vs close hold definition, and lead-in handling.

### Ready for Prompt 7 (on hold pending the above)
Configuration frozen in `worker/fable/config.py`; image `fable-poc:latest` rebuilt; 28 unit tests pass. Open items carried forward: couple-finding and cropping for crowded class videos (clip VID_20250202), downscaling before transfer, music-mode handling in the UI.
