# Fable — Prompt 2 report: technical research and recommendation

Date: 2026-10-31. Research only; nothing implemented. Builds on `01-inspection-report.md`.
Constraints applied: CPU-only Docker on the user's Mac for the PoC, near-zero cost per video (app is ~£5/month), video stays on the phone (any server copy is transient), components replaceable, Bachata only, positions per roadmap.

## 1. Recommendation in one paragraph

Run everything in one Python 3.11 Docker container. Beat grid from **Beat This!** (CPJKU, MIT, pip-installable, current best offline downbeat tracker). 8-count phase primarily from **spoken counts**: Silero VAD → faster-whisper (small, int8, digit hotwords) → wav2vec2 forced alignment → onset snap → weighted vote of every detected digit against the beat grid. When no counting is present, fall back to downbeat parity heuristics with confidence flagged low, and always expose a one-tap manual "this is count 1" correction. Frames via ffmpeg at each count-1 (1 to 3 frames). Position classification by **pose-first hybrid**: RTMPose (ONNX, CPU) gives coarse geometry (open vs close vs back-to-back) and locates the joined hands; **Claude Haiku 5.5** with cached reference images and strict JSON output gives the final label from full frame plus an upscaled hand crop; vote across frames; escalate disagreements to one Sonnet 5.5 call; otherwise `needs_review`. Estimated API cost about $0.005 to $0.03 per video. Compute cost is zero in the PoC.

## 2. Rhythm: beat grid and downbeats

| Option | Downbeats | CPU install | Accuracy | Licence | Verdict |
|---|---|---|---|---|---|
| **Beat This!** (ISMIR 2024) | Yes, no DBN needed | `pip install beat-this` + CPU torch | Ballroom downbeat F1 95.3, Candombe 99.7, GTZAN 78 | MIT | **Primary** |
| madmom RNN+DBN | Yes | Broken on Python ≥3.10 without forks; unmaintained | GTZAN ~0.6–0.7 | BSD code, CC BY-NC-SA weights | Avoid |
| librosa beat_track | No | Trivial | Beats only, 20–60 ms late bias | ISC | Fallback for onsets only |
| Essentia | No | Wheels exist | Not competitive | AGPL | Avoid |
| BeatNet / BeatNet+ | Yes | Depends on madmom | Below Beat This | CC BY 4.0 | Avoid |
| All-In-One | Yes + sections | NATTEN + Demucs + madmom | Good, but minutes on CPU | MIT | Avoid for PoC |

Key facts:
- No Bachata-annotated dataset exists. Ballroom and Candombe are the closest proxies. Salsa evidence shows Western-trained trackers degrade materially on Latin music (BeatNet F1 0.54 on salsa before fine-tuning). Bachata is rhythmically simpler than salsa, so expect better, but this must be measured.
- Bachata's bass accent on beat 4 can cause a half-bar phase error (tracker locks onto 3 or 4 as "1"). Nothing quantifies this. Plan for a "shift by N beats" correction.
- Beat This! processes 30 s windows natively, so a 30 s clip is its native unit. Constrain tempo to 100–140 BPM post hoc and snap to a constant grid (demos hold steady tempo).
- Half-beat (güira) octave errors are a known Bachata failure; if detected period implies >180 BPM, halve it.

## 3. 8-count phase (which bar is "1" vs "5")

**Plain finding: there is no reliable published method to get 2-bar hypermetrical phase from audio alone.** Downbeat trackers give bar starts; 1 vs 5 is often a dancer convention.

Order of preference:
1. **Spoken counts** (reliable when present). Pipeline: ffmpeg → 16 kHz mono → Silero VAD gate → optional Demucs vocal separation (20–60 s CPU per minute; run only if music dominates) → faster-whisper `small` int8, `word_timestamps=True`, `hotwords="one two ... eight"`, `language="en"` (second pass `es` if needed) → forced alignment with torchaudio wav2vec2 base-960h (Apache-friendly; avoid MMS_FA and CrisperWhisper, both non-commercial) → snap each digit to the nearest vocal-stem onset within ±120 ms → assign to nearest beat → each digit votes phase `(beat_index − (digit − 1)) mod 8`, weighted by word probability × onset strength → winning bin is phase, margin is confidence. Also compute the mod-4 fold: if mod-8 is ambiguous but mod-4 is sharp, report the specific "1 vs 5" ambiguity. Expected per-word timing ±100 ms; averaging 16+ digits gives phase well under ±50 ms.
2. **Hallucination defence** (Whisper emits text on most music-only audio): require word probability ≥0.5, alignment score threshold, onset within ±120 ms, drop segments with `no_speech_prob` >0.5 or `compression_ratio` >2.4, and a structural test: ≥4 digits with at least one monotone run of 3 whose spacing matches the beat period ±25%. Random hallucinations essentially never pass this.
3. **No counting, music only**: bar-level novelty / repetition parity test on downbeat-synchronous chroma (DIY heuristic, expect a modest edge over a coin flip on 30 s clips). Flag confidence low.
4. **No music, counting only**: RANSAC fit of `t = t0 + T·(d − 1 + 8m)` to digit onsets gives a synthetic grid and phase directly.
5. **Always**: manual "tap count 1" fallback in the review UI. Treat as a normal feature, not an exception.

CPU runtime estimate for a 60 s clip inside Docker: 30 s without Demucs, 45–90 s with. Extrapolated, not measured.

## 4. Frame extraction

ffmpeg with accurate seeking (`-ss` after `-i`, or decode once and pick frames by PTS). Extract at count-1 and at ±1 beat offsets configurable; default 3 frames per boundary (−0.25 s, 0, +0.25 s). Store frame timestamps and files per run so classification can be re-run without re-decoding. Resize to 768 px long edge for API calls; keep native frame for the hand crop. Test video is 360×640, which is the worst case for hand detail.

## 5. Visual position recognition

| Approach | Coarse classes (open / close / back-to-back) | Hand-hold detail (left over right) | CPU cost | Verdict |
|---|---|---|---|---|
| VLM few-shot with references | Strong | Marginal at 360p, better with upscaled hand crop | API only | **Final classifier** |
| Embedding k-NN (CLIP / SigLIP / DINOv2) | OK on person crops | Weak (CLIP-blind to fine spatial swaps) | Free | Only for frame de-duplication |
| Pose (RTMPose / RTMO via rtmlib, ONNX) | Strong via geometry (hip distance, shoulder orientation, wrist pairing) | Cannot read "which hand on top"; can read cross-hand hold if that is the real definition | Free, ~11 ms/person | **Pre-filter and hand locator** |
| MediaPipe Pose | Drops one dancer in close hold (documented issues) | n/a | Free | Avoid |
| Fine-tuned classifier | Later, from corrections | Later | Free | Defer per spec |

Honest expectations at 360p: coarse 3-class accuracy likely above 90%; "basic" vs "basic left over right" maybe 60–80% with crop-and-vote, lower without. Nothing published covers partner-dance hand holds. 1080p source footage would change this materially. **Question for the user:** is "left over right" a cross-hand hold (leader's left holds follower's left, so wrist pairing differs) or the same hands with left on top? The former is pose-tractable; the latter is pixel-level.

### Model choice and cost

Token facts verified against official docs: Claude charges ⌈w/28⌉×⌈h/28⌉ tokens per image, so a 768×432 frame is 448 tokens; four reference images about 1,800 tokens, cacheable (Haiku 5.5 minimum cacheable prefix 512 tokens; cache reads ~0.1×).

| Model | $/MTok in/out | 40 frames, refs cached | 120 frames cached |
|---|---|---|---|
| **Claude Haiku 5.5** | 0.10 / 0.50 | **$0.004** | **$0.012** |
| Claude Sonnet 5.5 (escalation only) | 2 / 10 | $0.08 | $0.25 |
| GPT-5.4-nano | 0.20 / 1.25 | $0.009 | $0.028 |
| Gemini 2.5 Flash-Lite | 0.10 / 0.40 | $0.008 | $0.025 |

Batch APIs halve these. All well under the £0.05 target; even escalating 20% of frames to Sonnet stays under £0.03 per video. Cost is not the constraint; accuracy is.

Implementation notes for the Anthropic call: use structured outputs (`output_config.format`) for guaranteed JSON with fields `position_id` (enum from the roadmap's library plus `unknown`), `confidence_bucket`, `evidence`. Put system prompt and reference images before a `cache_control` breakpoint, per-frame images after. API version 2026-10-21 rejects `temperature`, so sampling-based confidence is not available on Claude.

### Calibrated confidence

Verbalised VLM confidence is overconfident. Use, in order: vote share across the 1–3 frames per boundary plus the pose rule as a fourth voter; a second-pass yes/no on the runner-up class using the hand crop; cross-model agreement (Haiku + Gemini Flash-Lite) on uncertain frames only; and, once a few hundred human corrections exist, fit isotonic or Platt scaling on logged features (vote share, pass-2 agreement, pose agreement, hand-box pixel size) to set the `needs_review` threshold. That last step is calibration, not model training.

## 6. Position-change detection and snippet boundaries

Store per-cycle predictions, not just snippets. Merge rule as a configurable function: a change requires the new label to win in N consecutive cycles (default 1 for PoC, test 2) or exceed a confidence margin; a single `needs_review` cycle between two identical labels inherits the neighbours and is flagged. Snippet start defaults to the count-1 timestamp; evaluate a configurable lead-in (0, −0.25 s, −0.5 s) in Prompt 5 by watching playback.

## 7. Processing architecture for the PoC

- One Docker image: `python:3.11-slim` + ffmpeg + CPU torch + beat-this, faster-whisper, silero-vad, torchaudio, librosa, rtmlib/onnxruntime, anthropic SDK. ~1.5 GB. Pre-fetch model weights at build so it runs offline.
- Input: a local video path. Output: a run directory with `beats.json`, `count1.json`, `frames/`, `predictions.json`, `snippets.json`, and an HTML debug report. No Supabase in the first PoC loop; the app integration comes in Prompt 7.
- Everything behind small interfaces: `BeatTracker`, `PhaseEstimator`, `FrameSelector`, `PositionClassifier`, `ChangeDetector`, so each component is swappable.

## 8. Risks and unknowns

1. Beat This! has no Bachata evaluation; half-bar phase errors are plausible.
2. 8-count phase without spoken counting is unreliable by nature; the manual tap is a core feature.
3. 360p footage may make the hand-hold class unreliable regardless of model.
4. No local ffmpeg or Python audio stack on the Mac; all runtime figures are extrapolated until the container is built.
5. Licences: avoid madmom weights, MMS_FA, CrisperWhisper, Essentia in a commercial product.
6. Docker on Apple Silicon is arm64 Linux CPU only; throughput may be 2–3× slower than native.

## 9. What Prompt 3 needs from the user

1. Confirmation of the recommended stack (Beat This! + faster-whisper/wav2vec2 + RTMPose + Claude Haiku 5.5).
2. An Anthropic API key available to the container (env var only, never in the repo).
3. The answer to the "left over right" definition question above.
4. Whether the test video includes spoken counting (determines which phase path gets exercised first).

## Sources

Consolidated from three research threads. Primary: Beat This! (github.com/CPJKU/beat_this, arXiv 2407.21658); madmom issues #550/#553; Rapini & Jordanous salsa beat tracking (kar.kent.ac.uk/108524); SMC Blind Spot (arXiv 2605.12287); WhisperX (Interspeech 2023); CrisperWhisper timing table (github.com/nyrahealth/crisperwhisper); faster-whisper hotwords PR #731; Whisper hallucination studies (arXiv 2501.11378, 2505.12969, 2609.20195); torchaudio forced alignment tutorials; Claude vision token docs (platform.claude.com/docs/en/build-with-claude/vision); OpenAI images guide and pricing; Gemini image-understanding and pricing docs; FineBench (arXiv 2605.19846); CrossHOI-Bench (arXiv 2508.18753); MMVP (arXiv 2401.06209); RTMO (CVPR 2024), rtmlib; MediaPipe issues #4681/#5274; VLM calibration (arXiv 2405.02917, 2604.09529, 2607.22034); fiifee/dance-count README on 1-vs-5 ambiguity.
