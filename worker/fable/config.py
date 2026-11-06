from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Config:
    video: Path
    out: Path
    positions_file: Path = Path("/app/positions/positions.json")

    # Rhythm
    bpm_min: float = 100.0
    bpm_max: float = 140.0
    octave_error_bpm: float = 180.0  # above this, assume güira half-beat lock and halve
    min_beats_for_grid: int = 8

    # Phase
    whisper_model: str = os.environ.get("WHISPER_MODEL", "small")
    # Windows run in parallel threads (CTranslate2 releases the GIL). Measured on a
    # 10-vCPU Docker VM, 66 s counting clip: 1 worker/default threads 35 s, 4 workers x 2
    # threads 31 s, 2 x 4 threads 42 s, 1 x 10 threads 120 s (over-subscription). So:
    # 4 x 2 on 8+ CPUs, otherwise a single call with the library's default threads.
    # Env WHISPER_WORKERS / WHISPER_THREADS override.
    whisper_workers: int = int(os.environ.get("WHISPER_WORKERS", "4" if (os.cpu_count() or 1) >= 8 else "1"))
    whisper_threads: int = int(os.environ.get("WHISPER_THREADS", "2" if (os.cpu_count() or 1) >= 8 else "0"))
    # Pad each window to this many seconds instead of Whisper's 30 s (0 = keep 30 s).
    # Measured: no gain on CPU (decode dominates), kept as an experiment knob.
    whisper_chunk_s: int = int(os.environ.get("WHISPER_CHUNK_S", "0"))
    # One global VAD pass first; windows with no speech are not sent to Whisper.
    vad_skip_windows: bool = os.environ.get("WHISPER_VAD_SKIP", "1") != "0"
    onset_snap_window_s: float = 0.12
    digit_min_probability: float = 0.5
    structural_min_digits: int = 4
    structural_min_run: int = 3
    structural_spacing_tolerance: float = 0.25
    min_speech_seconds: float = 2.0

    # Frames — simplified pipeline (user decision 2026-11-01): ONE frame per 8-count,
    # at count 1, the moment the dancers arrive in the starting position. (Prompt 5
    # measured frames before count 1 as mid-transition: wrong on 4 of 5 cycles.)
    frame_offsets_s: tuple[float, ...] = (0.0,)
    # Optional: offsets in COUNTS (e.g. (-1,) = the beat before count 1), converted
    # with the detected count period. Overrides frame_offsets_s when set.
    frame_offsets_counts: tuple[float, ...] | None = None
    # A second frame, classified only when the first is unknown / low confidence.
    extra_frame_offsets_s: tuple[float, ...] = (0.25,)
    # Send all first-round frames in ONE call (a short strip across the 8-count) so
    # the model can see a turn finishing and name the settled hold. Prompt 6 sheets
    # showed dancers still turning on count 1 and settled by count 3-4 in class clips.
    multi_frame_call: bool = False
    scan_every_bar: bool = False        # bar-level (count 5) scanning off: noisy mid-turn frames, 2x cost
    use_pose: bool = False              # RTMPose off: half the compute, little value
    api_long_edge_px: int = 768
    hand_crop_scale: float = 2.0
    # Music-only clips: 1-vs-5 cannot be resolved from audio, so (user decision
    # 2026-11-01) the whole clip becomes one low-confidence snippet of this position.
    music_fallback_position: str = "basic"

    # Classification
    classify: bool = True
    primary_model: str = "claude-haiku-5-5"
    # Prompt 5: on the 140 s music clip Sonnet escalations were 72% of the cost,
    # confirmed the vote 5 times out of 40 and never overrode it. Off by default;
    # set to "claude-sonnet-5-5" to re-enable.
    escalation_model: str | None = None
    classify_concurrency: int = 6  # parallel API calls across cycles (283 sequential calls took 15 min)
    rule_in_vote: bool = False          # pose rule label excluded from the vote (Prompt 5)
    trust_frame_majority: bool = True   # a strict majority of frames is not escalated (Prompt 5)
    max_video_seconds: float = 180.0

    # Merge
    min_cycles_to_switch: int = 1
    lead_in_s: float = 0.0

    # Pricing, USD per million tokens, for the cost log. Update if prices change.
    prices: dict = field(
        default_factory=lambda: {
            "claude-haiku-5-5": {"in": 0.10, "out": 0.50, "cache_read": 0.01, "cache_write": 0.125},
            "claude-sonnet-5-5": {"in": 2.00, "out": 10.00, "cache_read": 0.20, "cache_write": 2.50},
        }
    )
