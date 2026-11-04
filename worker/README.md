# Fable worker (v2)

Audio in, count grid out. Spec: `../Fable_Master_Spec_v2.md` §3. The app cuts the video (which never
leaves the phone) into 4- or 8-count chunks from this grid; the user selects runs and files them.

```
grid.json: mode (counting | music | none), confidence, count_period_s,
           count1_times, bar_times, beat_times, speech_spans, ambiguous_1_vs_5, duration_s
```

- **counting**: spoken digits (faster-whisper) give each 8-count start; counts are spaced evenly inside it; no counts are invented while the instructor talks.
- **music**: Beat This! beat grid; bars every 4 beats; which bar is "1" is a guess (`ambiguous_1_vs_5`), fixed by one tap in the app.
- **none**: no usable audio.

## Run

```bash
cd worker
docker compose build                       # ~10 min first time; downloads ~2 GB of models
docker compose run --rm fable --input /media/VID_20260613_210605.mp4.mp4 --out /runs/first
docker compose run --rm fable --input /jobs/abc.wav --out /runs/abc --delete-audio   # audio-only upload
cat ../runs/first/grid.json
```

No API key is needed. `beats.json` and `phase.json` in the run folder are diagnostics.

## Job worker and throughput

```bash
docker compose up -d worker                 # one worker, drains the queue, polls every 5 s
docker compose up -d --scale worker=2       # more workers: claim_analysis_job uses SKIP LOCKED, so this is safe
docker compose logs -f worker
```

Where the time goes (10-vCPU Docker VM, measured 2026-11-04): a 6 s Whisper window costs
~1.3 s whatever its content, because faster-whisper pads every window to 30 s and the
decode dominates. So a 66 s counting clip is ~14 windows (plus re-splits of looping
windows) ≈ 25 s, beat tracking ≈ 4 s. What is already done about it:

- One Silero VAD pass per file; windows with no speech are never sent to Whisper
  (music-only clips: 29 windows -> 1, ~2x faster overall). `WHISPER_VAD_SKIP=0` disables.
- Models are loaded once per process and warmed up at start, including librosa's
  ~6 s numba JIT; the first job used to be ~8 s slower than the rest.
- Windows run on `WHISPER_WORKERS` threads with `WHISPER_THREADS` CTranslate2 threads
  each (default 4x2 on 8+ CPUs, 1 x library default below). Over-subscribing is much
  slower: 1 x 10 threads measured 120 s vs 35 s.

Tried and rejected (same clip, count-1 times compared against the previous output):
`base` model 2.7x faster per window but lost 3 of 13 count-1s; `BatchedInferencePipeline`
2x faster but returned a third of the words; shorter padding (`WHISPER_CHUNK_S`) no gain.
A Whisper stage is CPU-bound and already multi-threaded, so on one machine more workers
only help while a single job leaves cores idle: 2 is the sensible number on 8-10 vCPUs,
1 on the small hosted box. For a real queue of many videos, the lever is more machines.

## Tests (pure functions only, no models)

```bash
docker compose run --rm --entrypoint pytest fable -q
```

## Layout

- `fable/media.py` probe + 16 kHz mono extraction · `fable/rhythm.py` beat grid · `fable/phase.py` spoken-count detection ·
  `fable/grid.py` count grid + reference chunking · `fable/analyse.py` CLI · `fable/config.py`.
- `positions/` position list (becomes per-roadmap system categories in the app).
- `legacy_v1/` the v1 vision pipeline (frames, pose, Claude classification, merge, HTML report), kept for reference; not built.
