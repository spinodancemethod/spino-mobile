# Fable — Prompt 3: proof-of-concept design

Date: 2026-10-31. Design only; nothing implemented. Builds on `01-inspection-report.md` and `02-research-report.md`.

## 1. Goal and scope

Process **one** Bachata demo video end to end in a local Docker container and produce reviewable, timestamped position snippets plus every intermediate result. No Supabase, no app changes, no batch processing. The app integration is Prompt 7.

Success for the PoC is judged by a human (the user) watching the HTML report and the test video, not by "the code ran".

## 2. Processing steps and data flow

```
video.mp4
  │ ffmpeg
  ├─► audio.wav (16 kHz mono)            ─► 01 Rhythm ─► beats.json
  │                                        ─► 02 Phase  ─► count1.json
  └─► frames/ (at each count-1 ±offsets)  ─► 03 Pose    ─► pose.json
                                           ─► 04 Classify ─► predictions.json
                                           ─► 05 Merge    ─► snippets.json
                                                           ─► report.html
```

| Step | Input | Output | Component | Default |
|---|---|---|---|---|
| 00 Probe | video | `media.json` (duration, fps, w×h, has_audio) | ffprobe | Reject if duration > cap (see §6) |
| 01 Rhythm | audio | `beats.json`: tempo, beat times, downbeat times, confidence | `BeatTracker` → Beat This! `final0` | Tempo clamped 100–140 BPM; constant-grid snap |
| 02 Phase | audio + beats | `count1.json`: phase (0–7), count-1 timestamps, method, confidence, mod-4 ambiguity flag | `PhaseEstimator` → spoken-count voter; fallback downbeat parity; fallback "no audio" | Spoken counts first |
| 03 Frames | video + count1 | `frames/c{n}_{offset}.jpg` + `frames.json` | `FrameSelector` → ffmpeg accurate seek | 3 frames: −0.25 s, 0, +0.25 s |
| 04 Pose | frames | `pose.json`: per frame, 2 skeletons, derived features | RTMPose via rtmlib (ONNX CPU) | Features: hip distance / shoulder width, facing, wrist pairing |
| 05 Classify | frames + pose + library | `predictions.json`: per cycle, per frame label + bucket + evidence; per cycle vote | `PositionClassifier` → Claude Haiku 5.5 few-shot, structured output; Sonnet 5.5 escalation | Full frame + 2× hand crop |
| 06 Merge | predictions | `snippets.json` | `ChangeDetector` → configurable merge rule | 1-cycle change, review-cycle inheritance |
| 07 Report | all | `report.html` | Jinja template, inline images | Opens offline |

Each component is a Python class behind a small interface so any one can be swapped. Every step writes its JSON before the next starts, and each step can be re-run from the stored output of the previous one (`--from step`).

## 3. Component design

### 3.1 Rhythm (`BeatTracker`)
- Beat This! on the full audio (or the accompaniment stem if Demucs is run; default off for the PoC).
- Post-processing: median inter-beat interval → tempo; if tempo > 180 double the period (güira octave error); if outside 100–140 after that, flag `tempo_out_of_range`. Fit a constant grid by least squares; keep raw beats too.
- Bar phase from majority vote of downbeat predictions mod 4. Store the vote histogram.
- Confidence: mean beat activation at grid points, downbeat vote margin.

### 3.2 Phase (`PhaseEstimator`)
Three strategies tried in order; the first that returns a confident result wins, and all attempted results are stored.

1. **SpokenCountPhase**: Silero VAD → faster-whisper `small` int8, `word_timestamps`, hotwords for digits, `language=en` → normalise "1"/"one" → wav2vec2 forced alignment → snap to nearest onset within ±120 ms → structural plausibility test (≥4 digits, monotone run ≥3, spacing within ±25% of beat period) → weighted vote into 8 bins. Result: phase, margin, accepted digits with timestamps, rejected digits with reasons. Also mod-4 fold for the 1-vs-5 ambiguity flag. Demucs vocal separation is an opt-in flag if digit recall is poor.
2. **DownbeatParityPhase**: bar-level chroma self-similarity parity test. Confidence capped at "low".
3. **NoAudioPhase**: if `has_audio` is false or VAD finds < 2 s of speech and beat activation is weak, return no grid. Downstream produces **one snippet spanning the whole video** with `ai_confidence` 0.1 and `needs_review`, classified from 3 frames at 10%, 50%, 90% of duration so the snippet still gets a best-guess label.

Count-1 timestamps = grid beats where `(index − phase) mod 8 == 0`, from the first full cycle after 0 s to the last before end.

### 3.3 Frames (`FrameSelector`)
- ffmpeg `-ss` after `-i` for accurate seeking, one invocation per frame (fast for < 200 frames). JPEG quality 90, native resolution. Also a 768 px long-edge resized copy for the API.
- Offsets configurable; default `[-0.25, 0, 0.25]`. Prompt 5 evaluates whether 1 frame suffices.

### 3.4 Pose (`PoseFeatures`)
- rtmlib `Body` (RTMO detector + RTMPose) on each frame, keep the two largest skeletons, assign leader/follower by a heuristic that is **stored and surfaced** (taller skeleton = leader is wrong often; the PoC labels them A/B and lets the VLM decide roles).
- Features per frame: normalised inter-hip distance, each person's shoulder-line angle relative to the other, which wrist pairs are mutually nearest (A-left↔B-left means cross-hand hold), keypoint confidence. Hand bounding box around the nearest wrist pair, padded, for the crop.
- Provisional rule label: `back_to_back` if both shoulder lines face away; `basic_sensual` if hip distance small; `basic_left_over_right` if cross-hand pairing; else `basic`. Confidence from keypoint scores. This is a voter, not the answer.

### 3.5 Classification (`PositionClassifier`)
- Library: `positions.json` with id, name, description, distinguishing characteristics, reference image paths. Four Bachata positions plus `unknown`. The prompt enumerates only these ids.
- One Anthropic call per frame: system prompt + reference images behind a `cache_control` breakpoint; then full frame, 2× upscaled hand crop, and the pose summary as text. Structured output schema: `{position_id: enum, confidence_bucket: high|medium|low, evidence: string, roles_swapped_uncertain: bool}`. Model `claude-haiku-5-5`, max_tokens 256. API key from `ANTHROPIC_API_KEY` only.
- Per cycle vote: 3 frame labels + pose rule label. Unanimous → high; 3 of 4 → medium; otherwise one escalation call to `claude-sonnet-5-5` with all 3 frames; if still split → `unknown`, `needs_review`.
- Store raw responses, token usage, and cost per call.

### 3.6 Merge (`ChangeDetector`)
- Walk cycles in order; start a new snippet when the label differs from the current snippet's label. Parameter `min_cycles_to_switch` (default 1; test 2 in Prompt 5). A cycle labelled `unknown` between two identical labels is absorbed and flagged.
- Snippet fields: position_id, start (count-1 of first cycle + `lead_in`, default 0), end (count-1 of the cycle after the last, or video end), cycle indices, mean confidence, review flag.
- Rules are pure functions over `predictions.json`, so Prompt 5 can re-run merging without any API calls.

### 3.7 Report
Single HTML file: media facts, tempo and beat grid plot over a waveform, accepted/rejected digits with timestamps, phase histogram, a row per cycle with its 3 frames, pose overlay, per-frame labels, vote result, and the final snippet table with `<video>` elements that seek to each snippet. Everything inline so it opens from the run folder.

## 4. Position library for the PoC

| id | name | description (from user) | pose cue |
|---|---|---|---|
| basic | Basic | Open hold, leader's left to follower's right, space between dancers | large hip distance, facing, L↔R wrists |
| basic_sensual | Basic sensual | Basic in a close hold | small hip distance, facing |
| basic_left_over_right | Basic left over right | Cross-hand hold: leader's left holds follower's left, over the right | A-left↔B-left wrists nearest |
| shadow_back_to_back | Shadow back to back | Backs to each other | shoulder lines both facing away |
| unknown | Needs review | fallback | — |

Reference photos to be supplied by the user before Prompt 4; the pipeline runs with descriptions only until then.

## 5. Storage decision for the PoC

**No upload at all.** The container reads the file from a mounted folder (`testMedia/`). This matches the user's rule that video stays on the phone and defers the transfer question to Prompt 7, where the answer will be: the app transcodes to a small proxy before sending, and the server deletes it after processing. Supabase Storage is sufficient for that proxy. No external object storage.

## 6. Video length, size and the production transfer path

Decision needed, recommendation given:
- **Cap running length at 3 minutes** for the feature (a 2-minute demo at 120 BPM is ~60 cycles; 3 minutes is ~90). Longer videos get a clear message. Configurable.
- **Transcode on the phone before transfer** in production: 480p or 720p long edge, H.264, ~1.5 Mbps, audio AAC mono 64 kbps. A 2-minute 1080p phone video (~250 MB) becomes ~20–25 MB. Expo has no first-party transcoder; this needs a native module such as `react-native-video-processing` / `ffmpeg-kit` or a server-side transcode of the original. **Trade-off for Prompt 7:** sending the original and transcoding on the server is simpler and keeps hand detail for classification, but uploads 10× more bytes. Recommendation: upload the original for the PoC-to-production step (Supabase free tier allows 50 MB per file; 2-minute phone videos may exceed this, so Pro tier or a client-side transcode will be needed), and evaluate in Prompt 5 whether 480p is enough for the hand-hold class before committing to on-device compression.
- The pipeline itself only ever uses 16 kHz mono audio and ~60–270 JPEG frames, so processing cost does not scale with input bitrate.

## 7. How success is measured (Prompt 5 inputs)

The user hand-labels the test video once: true count-1 timestamps for a few cycles, and true position per cycle. Metrics:
- Tempo error (BPM), beat F-measure at 70 ms, count-1 phase correct (yes/no), count-1 mean absolute offset.
- Per-cycle position accuracy and confusion matrix; fraction flagged `needs_review`; accuracy among non-flagged cycles.
- Snippet boundary accuracy versus the labelled change points; false and missed changes.
- Wall-clock per step, API tokens and cost per video.

## 8. Runtime and repository layout

- `worker/` (already git-ignored; will be un-ignored for the PoC code, `.env.worker.local` stays ignored): `Dockerfile`, `pyproject.toml`, `fable/` package with one module per component, `run.py` CLI (`run.py --video /media/x.mp4 --out /runs/x --from classify`), `templates/report.html`, `positions/positions.json` + reference images, `tests/` for the pure functions (vote, merge, plausibility test).
- Image: `python:3.11-slim`, ffmpeg, CPU torch, beat-this, faster-whisper, silero-vad, torchaudio, librosa, rtmlib + onnxruntime, anthropic, jinja2. Model weights fetched at build. ~1.5–2 GB.
- `docker compose run fable --video ...` with `testMedia/` and `runs/` mounted; `ANTHROPIC_API_KEY` passed from the host environment.

## 9. Out of scope for the PoC

Supabase tables, app UI, job queue, notifications, batch, Demucs by default, Spanish counting, count 3/4 recognition, model training.

## 10. Open decisions for the user

1. Approve the 3-minute cap (configurable).
2. Approve un-ignoring `worker/` so the PoC code is committed.
3. Supply reference photos (2–4 per position, ideally from a similar camera angle to the demo videos) before or during Prompt 4.
4. Confirm an Anthropic API key will be available on the host when Prompt 4 starts.
