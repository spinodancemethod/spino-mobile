# Fable — Prompt 5 report: critical evaluation of the proof of concept

Date: 2026-11-01. Code: `worker/`. Runs: `runs/eval1` … `runs/eval5b` (counting clip), `runs/music-dry` (music clip). All run folders contain `report.html`.

Inputs: the 35 s a-cappella counting clip with the user's ground truth (`docs/fable/labels/VID_20260613_210605.json`), and a new 140 s clip with music and no counting (`PXL_20240530_205750770.TS.mp4`, 1080p HEVC, 347 MB). Vocabulary: the 10 condensed family positions.

## 1. Verdict

The approach is sound; three real defects were found and fixed, one open risk remains.

| Component | Before Prompt 5 | After | Status |
|---|---|---|---|
| Count-1 boundaries (spoken counts) | correct per user | correct, ±0.1–0.25 s run-to-run jitter | OK, see §4.3 |
| Beat grid on music | never tested | 105 BPM, 6 ms median fit error, bars 92% consistent | fixed (§3.1) |
| 8-count phase on music without counting | never tested | bar grid right, **1-vs-5 ambiguous as predicted** | open, needs user check (§4.1) |
| Position per cycle (3 labelled cycles) | 2 of 3, 1 miss | 3 of 3 in the best run, 2 of 3 + 1 flagged in the others | improved (§3.2–3.4) |
| Snippets | 2 of 3 expected | 3 of 3 in best run | improved |
| Cost per 35 s clip | $0.022 | $0.004–0.015 | 2–5x cheaper |
| Pose rule as a voter | wrong on most cycles | removed from vote | fixed |
| Sonnet escalation | 4 calls, 0 helpful | now cannot force unknown; rarely reached | fixed (§3.4) |

## 2. Results on the counting clip, run by run

Ground truth: cycle 0 basic, 1 back-to-back, 2–4 unclear (merge into prior), 5 basic. Expected snippets: basic 0–5.1, back-to-back 5.1–30.1, basic 30.1–35.1.

| Run | Change tested | c0 | c1 (back-to-back) | c2–4 | c5 (basic) | Snippets | Cost |
|---|---|---|---|---|---|---|---|
| eval1 | 10 labels, old offsets (-0.25/0/+0.25), rule in vote, Sonnet esc | basic | **unknown** (2 frames right, pre-count frame wrong, Sonnet said shadow) | cuddle/cuddle/unknown | basic | basic, cuddle, basic | $0.023 |
| eval2 | offsets 0/+0.25/+0.5 | basic | **unknown** (same failure) | cuddle | **unknown** (Sonnet low) | basic, cuddle | $0.025 |
| eval3 | arrangement-first prompt, no rule in vote, frame majority not escalated | basic | **shadow** (2 low frames outvoted 1 medium) | cuddle ×3, unanimous | basic | basic, shadow, cuddle, basic | $0.005 |
| eval4a | majority counts only medium/high frames | basic | **back-to-back** | cuddle ×3 | unknown (Sonnet low) | basic, b2b, cuddle | $0.014 |
| eval4b | repeat of 4a | basic | **back-to-back** | cuddle ×3 | basic | **basic, b2b, cuddle, basic — exact match** | $0.004 |
| eval5a/b | 2 extra Haiku frames before escalating | basic | back-to-back | cuddle | basic by vote (0.48 / 0.65), Sonnet low → unknown | basic, b2b, cuddle | $0.015 / $0.011 |

| eval6-final | escalation cannot force unknown (rebuilt image) | basic | back-to-back | cuddle ×3 | **basic** 0.65, flagged for review | **basic 0–5.1, b2b 5.1–11.4, cuddle 11.4–30.2, basic 30.2–35.1 — matches expected** | $0.010 |

Final configuration verified on the API (eval6-final): all three labelled cycles correct, cycles 2–4 consistently cuddle, four snippets as expected with the last one flagged for review.

The cycle-5 frames show the follower with her back to the camera and the hands hidden; basic vs close hold is genuinely ambiguous there. A flagged "basic" is the correct output.

## 3. Defects found and fixed

### 3.1 Beat grid drifted 2 s over the music clip (rhythm.py)
Beat This! output is at 10 ms resolution, so a 0.5714 s period appears as alternating 0.56/0.58 s gaps and the median (0.58) is 9 ms too long. The grid fit assigned beat indices from `(t − t0)/period`, which mis-assigns once the accumulated error exceeds half a beat (~30 beats in). Result: 148 ms median fit error and a flat downbeat vote (18/16/17/15), i.e. no usable bar phase. Fix: assign indices from consecutive gaps, then refit. Now 6 ms median error, downbeat vote 61/5/0/0. Two unit tests added. This would have broken every music video longer than about 20 s.

### 3.2 Frames before count 1 are mid-transition (config.py)
The −0.25 s frame voted wrong on 4 of 5 labelled cycles across runs. Offsets are now 0 / +0.2 / +0.4 s, with +0.6 / +0.8 s extracted as a second round.

### 3.3 Back-to-back read as shadow (classify.py prompt)
Seen side-on, back-to-back looks like one dancer behind the other, and both Haiku and Sonnet called it shadow or cuddle. The prompt now follows the user's three-part taxonomy: the model must first commit to `body_arrangement` (facing / same direction / opposite directions / unclear) as the first JSON field, then choose only among positions listed under that arrangement, with an explicit note that back-to-back means faces point opposite ways. Positions are grouped under their arrangement in the prompt, derived from the `attribute` field in positions.json.

### 3.4 Voting and escalation (classify.py)
- Pose rule removed from the vote (`rule_in_vote=False`). It was wrong on most cycles and its 0.2–0.3 weight diluted agreement enough to trigger escalations.
- A strict majority of medium/high-confidence frames is accepted without escalation (`trust_frame_majority=True`).
- If no confident majority, two more Haiku frames are classified first (~$0.0006) before any Sonnet call (~$0.005). Sonnet was wrong or unhelpful on every escalation in this evaluation (said shadow for back-to-back twice, basic_sensual-low for basic three times).
- Escalation can confirm, or override only with high confidence. It never forces `unknown`, because an unknown cycle silently merges into the previous snippet and hides a boundary; a flagged low-confidence label is reviewable.

## 4. What is still not reliable

### 4.1 Count 1 vs count 5 on music without counting — needs the user's ear
The music clip has no spoken counts (Whisper found "and", "six", "five" in 140 s). The bar grid is solid, but a Bachata bar is 4 beats and an 8-count is 2 bars; audio alone cannot say which bar is "1". The pipeline proposes count-1 at **1.73 s, then every 4.571 s**, confidence 0.28, flagged `ambiguous_1_vs_5`. The alternative is 4.02 s + 4.571 s·n. **Please open `runs/music-dry/report.html` and play a few snippet starts: do they land on "1" or on "5"?** Whichever it is, the production answer is the planned "tap count 1" step in the app, which resolves this in one tap and also fixes clips that start mid-phrase. The grid also shows a stretch of 2-beat downbeat spacing around 60–75 s (a break in the song); the constant grid rides through it, which is correct behaviour if the dancers keep counting through the break.

### 4.2 Low-resolution, back-to-camera frames
At 360p with hands hidden the model's confidence is honestly low. The three new 1080p clips should help (Prompt 6). If not, two cheap options: send the native-resolution hand crop (currently 2x of a 360p crop), or classify from two frames in one call.

### 4.3 Count-1 jitter between runs
The same clip gave count-1 at 11.61 / 30.08 s in one run and 11.38 / 30.17 s in another. Whisper int8 on CPU is not bit-exact across runs, and the cycle clustering is sensitive to one digit's timing. 0.1–0.25 s is within a quarter beat and inside snippet tolerance, but it means `--from classify` comparisons must reuse the same phase output (done for eval4/5). Worth snapping count-1 to the beat grid when music is present (already implemented; untested on a clip that has both music and counting).

### 4.4 Untested
- Music **plus** counting: no clip yet. This is the most common real case.
- 1080p/HEVC clips through the full pipeline (only probed and used for the rhythm test). Pose on 30 cycles × 5 frames at 1080p took 50 s; fine.
- Size: 347 MB for 140 s confirms that the phone must downscale before transfer (Prompt 7: ~720p, ~3–5 Mbit/s → ~60 MB for 2 min; audio 16 kHz mono).

## 5. Cost and time (35 s clip, final configuration)

- Haiku 5.5 per frame ~$0.00016 (cached prompt). 6 cycles × 3 frames = $0.003; worst case with round 2 and one Sonnet call ≈ $0.015.
- A 2-minute video at 110 BPM ≈ 28 cycles ≈ $0.015 typical, ≈ $0.05 worst case. Well inside the budget.
- Wall clock on the Mac CPU: ~100 s for 35 s; music clip 140 s took ~130 s without classification.

## 6. Recommendation

Proceed to Prompt 6 (validation on the three 1080p clips plus a music-with-counting clip if the user can record one). No alternative stack is needed: the failures were in my glue code and prompt, not in Beat This!, Whisper, or Haiku. Keep Sonnet escalation available but expect it to be rarely used; revisit after Prompt 6 whether to remove it.

Before Prompt 6 the user should: (1) answer §4.1 for the music clip, (2) optionally give rough ground truth for the three 1080p clips (position per 8-count, or just "the boundaries looked right/wrong") after seeing their reports.

## 7. Addendum (same day): user feedback and bar-level scanning

### 7.1 Music clip: count 1 is at ~4.0 s
The user listened: count 1 falls at about 4.0 s, i.e. the **alternative** phase. The downbeat-only guess (first downbeat = count 1) was wrong, as the 1-vs-5 flag predicted. A bar-level novelty test (chroma + MFCC + RMS change at each bar start) favoured 4.01 s by only ~0.25 σ, so it was right here but too weak to rely on. Conclusion unchanged: without spoken counts the phase needs a user tap; music analysis can at best pick the default.

### 7.2 Scan every bar (counts 1 and 5) — user decision
Positions are now scanned at every bar start, not every 8-count (`scan_every_bar=True`; `phase.bar_times_from_count1` interleaves count-5 midpoints; downbeat-only path emits every bar). Frames are taken at +0 / +0.2 / +0.4 s *after* the bar start (not at counts 4/8, which are mid-transition). Each scanned bar carries `count` = 1 or 5 when the phase is known.

Effect on the counting clip (eval7, 12 bars): count-1 bars behaved as before; **count-5 bars were noisy** (scattered low-confidence labels: shadow 0.30, cross_hand 0.42, handshake 0.27, shadow 0.27). The frame at count 5 shows the dancers mid-turn. Unconstrained, this fragmented the clip into 8 snippets. Two merge rules fix it, tested offline and then live:
- a bar below `min_confidence_to_switch` (0.5) cannot start a snippet and continues the previous one;
- a **count-5** bar needs `min_confidence_to_switch_on5` (0.75), because positions normally change on 1.
With these, eval7 reproduces the four expected snippets exactly. A repeat (eval8) gave three: the final `basic` at 30.2 s came back at 0.48 confidence (below 0.5) and merged into cuddle. That cycle's frames are back-to-camera with hidden hands; its confidence across six runs was 0.48–0.65, so it will sit on either side of the threshold. This is the honest state at 360p; the 1080p clips in Prompt 6 will show whether it matters in practice.

### 7.3 Sonnet escalation removed by default; calls parallelised
On the 140 s music clip the first full run cost **$0.35** and classification took **15 minutes** (283 sequential Haiku calls at 2.8 s plus 40 Sonnet calls). Sonnet was 72% of the cost, confirmed the vote 5 times out of 40 and never overrode it. Changes: `escalation_model=None` by default (re-enable by setting it), cycles classified in parallel (`classify_concurrency=6`, first cycle alone to write the prompt cache once).

Final music run (music-final): **$0.093, classification 150 s**, 61 bars → 19 snippets, 41 bars flagged for review. No ground truth; the two highest-confidence labels I spot-checked (cuddle at 15.4 s, close hold at 45.2 s) are correct. This is a social-dance clip with a position change almost every 8-count, so 19 snippets in 140 s may well be right; the user should skim `runs/music-final/report.html`.

### 7.4 Updated cost and time (final configuration)
| Clip | Bars | API calls | Cost | Classify time |
|---|---|---|---|---|
| 35 s counting, 360p | 12 | 48 | $0.014 | 39 s |
| 140 s music, 1080p | 61 | ~290 | $0.093 | 150 s |

Per 2-minute video: ~$0.05–0.10 and ~2–3 min on the Mac CPU (pose 2 min + classify 2.5 min; a server with more cores or a GPU halves this). Within budget, but Prompt 7 must treat processing as a background job with a progress state, not a request/response.

### 7.5 Known weaknesses carried into Prompt 6
1. Count-5 bars are inherently less settled; the 0.75 threshold is a heuristic tuned on one clip.
2. Bar scanning doubles API calls; the 41/61 review flags on the music clip show the model is often unsure at bar level. The review UI (Prompt 9) must make skimming flagged snippets fast.
3. ~~Still no clip with music **and** counting.~~ Not needed: the user confirms demos are always either music or voice counting, never both. The two modes are the two tested paths. The pipeline should report which mode it detected (dense digits → counting; otherwise music) so the app knows whether to ask for the count-1 tap.
