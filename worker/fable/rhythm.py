"""Step 01: beat grid from Beat This!, snapped to a constant tempo.

Output (beats.json):
  tempo_bpm, period_s, grid_t0, grid_beats (list of seconds), raw_beats,
  raw_downbeats, downbeat_phase4 (which grid index mod 4 is a bar start),
  downbeat_vote (4 bins), flags, confidence
"""
from __future__ import annotations

import functools
from pathlib import Path

import numpy as np

from .config import Config


def _fit_grid(raw: np.ndarray, period: float) -> tuple[float, float]:
    """Least-squares fit t_k = t0 + k*T given raw beat times and an initial period.

    Beat indices are assigned from consecutive differences (each gap is a whole
    number of periods), not from (t - t0)/period. The latter mis-assigns indices
    once the accumulated error of a slightly wrong initial period exceeds half a
    beat, which happened on the 140 s music clip (0.580 s median vs 0.571 s true:
    2 s of drift by the end). Found in Prompt 5.
    """
    steps = np.maximum(1, np.round(np.diff(raw) / period))
    k = np.concatenate([[0.0], np.cumsum(steps)])
    A = np.vstack([np.ones_like(k), k]).T
    t0, T = np.linalg.lstsq(A, raw, rcond=None)[0]
    # One refinement pass with the fitted period, in case the initial guess was off.
    steps = np.maximum(1, np.round(np.diff(raw) / T))
    k = np.concatenate([[0.0], np.cumsum(steps)])
    A = np.vstack([np.ones_like(k), k]).T
    t0, T = np.linalg.lstsq(A, raw, rcond=None)[0]
    return float(t0), float(T)


@functools.lru_cache(maxsize=1)
def _file2beats():
    """Loaded once per process (~1 s)."""
    from beat_this.inference import File2Beats
    return File2Beats(checkpoint_path="final0", device="cpu", dbn=False)


def track(audio_wav: Path, duration_s: float, cfg: Config) -> dict:
    f2b = _file2beats()
    beats, downbeats = f2b(str(audio_wav))
    beats = np.asarray(beats, dtype=float)
    downbeats = np.asarray(downbeats, dtype=float)
    flags: list[str] = []

    if len(beats) < cfg.min_beats_for_grid:
        return {
            "ok": False,
            "reason": f"only {len(beats)} beats detected",
            "raw_beats": beats.tolist(),
            "raw_downbeats": downbeats.tolist(),
            "flags": ["too_few_beats"],
        }

    period = float(np.median(np.diff(beats)))
    bpm = 60.0 / period
    if bpm > cfg.octave_error_bpm:
        # Güira eighth-notes can lock the tracker to double tempo. Keep the
        # sub-sequence that best aligns with the predicted downbeats.
        flags.append("octave_halved")
        offs = [beats[0::2], beats[1::2]]
        score = [np.mean([np.min(np.abs(s - d)) for d in downbeats]) if len(downbeats) else 0 for s in offs]
        beats = offs[int(np.argmin(score))]
        period = float(np.median(np.diff(beats)))
        bpm = 60.0 / period
    if not (cfg.bpm_min <= bpm <= cfg.bpm_max):
        flags.append("tempo_out_of_range")

    t0, T = _fit_grid(beats, period)
    # Extend the grid across the whole file.
    k_min = int(np.floor(-t0 / T))
    k_max = int(np.ceil((duration_s - t0) / T))
    ks = np.arange(k_min, k_max + 1)
    grid = t0 + ks * T
    keep = (grid >= 0) & (grid <= duration_s)
    grid, ks = grid[keep], ks[keep]

    # Residual of raw beats against the fitted grid, as a confidence proxy.
    resid = np.array([np.min(np.abs(grid - b)) for b in beats])
    grid_fit_ms = float(np.mean(resid) * 1000)

    # Downbeat vote: which grid index mod 4 do downbeats land on?
    vote = np.zeros(4)
    for d in downbeats:
        k = int(np.round((d - t0) / T))
        vote[k % 4] += 1
    phase4 = int(np.argmax(vote)) if vote.sum() else 0
    margin4 = float((np.sort(vote)[-1] - np.sort(vote)[-2]) / vote.sum()) if vote.sum() > 1 else 0.0

    return {
        "ok": True,
        "tempo_bpm": round(60.0 / T, 2),
        "period_s": T,
        "grid_t0": t0,
        "grid_index_start": int(ks[0]),
        "grid_beats": grid.tolist(),
        "raw_beats": beats.tolist(),
        "raw_downbeats": downbeats.tolist(),
        "downbeat_phase4": phase4,
        "downbeat_vote": vote.tolist(),
        "downbeat_margin": margin4,
        "grid_fit_mean_ms": grid_fit_ms,
        "flags": flags,
    }
