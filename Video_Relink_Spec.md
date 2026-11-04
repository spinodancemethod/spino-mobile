# Video Relink Spec — byte hash v3 + on-device audio fingerprint

Status: draft for approval, 2026-11-04. Covers how a `video_uploads` row finds its file again after the local reference breaks. Builds on the recovery metadata from `20260819_add_video_recovery_metadata.sql` and the sampled hash from `20261103_content_hash_v2.sql`.

## 0. Why

Today a missing video is recovered by matching duration, file size and a byte-level hash (`v2-`: SHA-256 over size + first 1 MB + last 1 MB). That works when the bytes are untouched (copy, move, Drive, AirDrop) and fails whenever the file is re-encoded: Google Photos "Storage saver", iCloud "Optimise Storage" proxies, WhatsApp/Messages/Instagram round-trips, gallery trims. In those cases size, head and tail all change together, so no byte hash can help.

Two changes:

1. **Hash v3** drops file size from the hash input. Size stays as a column (it is still a cheap prefilter for exact copies) but is no longer baked into the fingerprint.
2. **Audio fingerprint** computed on device from the decoded audio track. Robust to re-encoding, resolution changes and container changes. Used only when the byte hash fails.

Non-negotiables carried from the Fable spec: video never leaves the phone, no per-video server cost, no network needed to relink.

## 1. Matching funnel

For each missing record, device videos are filtered in this order. Each stage is cheaper than the next and runs only on survivors of the previous one.

| Stage | Input | Cost per device video | Typical survivors (500-video library) |
|---|---|---|---|
| 1. Duration | media library listing | none (no file opened) | 1–5 |
| 2. Byte hash v3 | 2 MB read | ms | 0–1 (exact copies) |
| 3. Audio fingerprint | native audio decode | ~1–2 s per 2 min clip | 0–1 (re-encodes) |

Rules:

- Duration tolerance stays ±0.5 s. A re-encode can shift duration by one audio frame (~20 ms), not more.
- File size is **not** a filter in the funnel any more. An exact copy still matches at stage 2 without it, and a re-encode must not be rejected before stage 3.
- A stage 2 hit is final: stage 3 is skipped.
- Stage 3 runs on at most `MAX_FINGERPRINT_CANDIDATES = 5` survivors per missing record, nearest duration first, so a pathological library cannot make the scan take minutes.
- A record with no stored fingerprint (legacy, or the clip has no audio track) stops at stage 2.
- Results carry a `matchKind: 'exact' | 'audio'`. The UI labels audio matches "Matched by audio" so the user knows the file is a re-encode of the original.

Nothing new is uploaded. Nothing runs on the worker.

## 2. Byte hash v3

`lib/videoHash.ts`

```
v3 = "v3-" + hex(sha256(first min(1 MB, size) bytes ‖ last 1 MB bytes if size > 2 MB))
```

Identical to v2 minus the `v2:<size>:` prefix bytes. New imports write v3.

Compatibility: `calculateVideoContentHash(uri, version)` where `version` is derived from the **stored** hash's prefix (`v3-`, `v2-`, or none = legacy whole-file). Relink verification hashes a candidate with the stored record's version, so old rows keep matching exact copies without a backfill. `reuseStoredAnalysis` (grid reuse by hash) is unaffected: it compares stored values only.

DB: constraint widens to `^(v2-|v3-)?[a-f0-9]{64}$` (migration + `01_tables.sql`).

## 3. Audio fingerprint

### 3.1 Native: `AudioExtract.audioFeatures(videoUri)`

Extends the existing `modules/audio-extract` module (Swift: AVAssetReader; Kotlin: MediaExtractor + MediaCodec). Decodes the first audio track to PCM in memory, downmixes to mono, and reduces it to per-frame band energies. No temp file.

```
hopSeconds   = 0.05                          // 20 frames / s
frames       = ceil(duration / hopSeconds)   // 3 min clip -> 3600
bands        = [ full, low, high ]
  full : RMS of mono signal
  low  : RMS of one-pole low-pass, fc = 200 Hz      (bass / kick)
  high : RMS of (signal - one-pole low-pass, fc = 2 kHz) (hats / consonants)
returns { sampleRate, durationSeconds, hopSeconds, full: Float32[frames], low: Float32[frames], high: Float32[frames] }
```

Rejects with `E_NO_AUDIO` when there is no audio track. Rejects with `E_DECODE` on codec failure. Callers treat both as "no fingerprint", never as a relink failure.

Why band energies and not spectrograms: the output is ~10k floats for a 3 min clip, cheap to cross the bridge, and loudness envelopes in three bands survive AAC at any bitrate. Full-spectrum fingerprints (Chromaprint-style) are overkill for "is this the same recording" when duration already matches.

### 3.2 JS: `lib/audioFingerprint.ts` (pure, unit-tested)

```
encode(features) -> string
  for each band: v = log10(rms + 1e-6); z = (v - mean) / std   // loudness-invariant
  quantise z to int8 in [-4, 4]
  payload = frames(uint16) ‖ int8[3 × frames]
  return "afp1-" + base64(payload)                              // ~11 KB for 3 min
```

```
compare(a, b) -> { score: 0..1, offsetFrames }
  require |framesA - framesB| <= 20                             // ±1 s
  for offset in -20..+20:
      score(offset) = mean over bands of normalised cross-correlation on the overlap
  return max
```

Match threshold `AUDIO_MATCH_THRESHOLD = 0.85`, confirmed in §6 against real clips before it is frozen. Silence-only clips (std ≈ 0 in every band) encode to `null`: no fingerprint, stage 2 only.

### 3.3 Storage

`video_uploads.audio_fingerprint text` (nullable, `afp1-` prefix constraint). One column; the prefix carries the version, as with `content_hash`.

### 3.4 When it is computed

- **Import** (`add-video.tsx`): after the picker returns and the byte hash is written, in the background. The screen does not wait for it. Saved with the upsert if ready, otherwise patched onto the row when it finishes.
- **Relink** (`useRelinkVideoUpload`): after a successful relink the fingerprint is recomputed from the new file if the row has none.
- **Backfill**: when `useVideoAssetAvailability` resolves a legacy row to AVAILABLE and the row has no fingerprint, compute and patch it once (rate-limited to one at a time, lowest priority). Existing videos become recoverable without the user doing anything.

## 4. Scan diagnostics

Already in the working tree: the "no matches" snackbar prints counts per stage. Extend with `fingerprintTried`, `fingerprintBelowThreshold`, `fingerprintUnavailable`, and show the best score on a miss (e.g. "best audio score 0.62") so threshold tuning can be done from a release build.

## 5. Steps

Each step is a separate change with typecheck + tests green, and a FEATURES.md entry.

| # | Step | Touches | Done when |
|---|---|---|---|
| 0 | Prerequisites already in working tree: Android asset-id capture, scan diagnostics | `lib/pickedMediaAsset.ts`, `useVideoRelinkRecommendations.ts` | committed |
| 1 | Hash v3 + version-aware verification + migration | `videoHash.ts`, `videoRelinkVerification.ts`, `useRelinkVideoUpload.ts`, `add-video.tsx`, SQL | exact-copy relink of an old v2 row and a new v3 row both pass on device |
| 2 | Remove file size from the funnel | `videoLibraryScanner.ts`, `videoRelinkVerification.ts`, `videoRelinkDiscovery.ts`, tests | a candidate with a different size but matching hash is accepted |
| 3 | Native `audioFeatures` (iOS + Android) | `modules/audio-extract/*` | returns 3 × N floats for the test clip on both platforms; `E_NO_AUDIO` on a silent/mute clip |
| 4 | `lib/audioFingerprint.ts` encode/compare + tests | new | unit tests: same signal at two bitrates scores > 0.85; two different clips of equal length score < 0.6 |
| 5 | Column + capture at import + relink refresh | SQL, `models.ts`, `useVideoUploads.ts`, `add-video.tsx`, `useRelinkVideoUpload.ts` | new import writes `afp1-…`; import UI does not stall |
| 6 | Stage 3 in the finder + "Matched by audio" label + diagnostics | `useVideoRelinkRecommendations.ts`, `local-videos.tsx` | a video re-exported from Google Photos Storage saver relinks |
| 7 | Backfill for legacy rows | `useVideoAssetAvailability.ts` or a small hook | old rows gain fingerprints after one app session with the videos present |
| 8 | Threshold tuning + release | `testMedia/` clips | §6 table filled in; threshold frozen |

Step 3 is the only one with native code and the only one that needs a dev-client rebuild to test.

## 6. Validation (step 8)

Using the clips in `testMedia/` plus one real class recording:

| Pair | Expected | Score |
|---|---|---|
| Same clip, untouched copy | exact (stage 2) | n/a |
| Same clip, re-exported at 720p / lower bitrate | audio ≥ 0.85 | |
| Same clip, sent through WhatsApp | audio ≥ 0.85 | |
| Same clip trimmed by 0.3 s at the start | audio ≥ 0.85 (offset search) | |
| Two different clips of the same length | audio < 0.6 | |
| Same music track, different class recording | audio < 0.85 (speech + room differ) | |

If the last row fails, tighten with a fourth band (mid 200 Hz–2 kHz) before raising the threshold.

## 7. Out of scope

- Matching videos the app has never seen (no stored fingerprint, no backfill opportunity).
- Partial matches (one clip contained in another). Duration gate excludes them by design.
- Worker involvement of any kind.
