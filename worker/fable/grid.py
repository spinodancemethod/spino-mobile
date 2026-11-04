"""v2: turn rhythm + phase results into the count grid the app consumes. Pure.

Spec: Fable_Master_Spec_v2.md §3.

  {
    "mode": "counting" | "music" | "none",
    "confidence": 0..1,
    "count_period_s": float | None,
    "count1_times": [...],   # start of each 8-count (counting: detected; music: guess)
    "bar_times": [...],      # every 4 counts
    "beat_times": [...],     # every count
    "speech_spans": [[a,b],...],  # instructor talking, not counting
    "ambiguous_1_vs_5": bool,
    "duration_s": float
  }
"""
from __future__ import annotations

import numpy as np


def _speech_spans(asr: dict | None, min_gap_s: float = 0.6, min_len_s: float = 1.0) -> list[list[float]]:
    """Transcript segments that are mostly words rather than digits, merged when
    adjacent. Spans shorter than `min_len_s` are dropped: on music clips Whisper
    emits one-word hallucinations ("and", "six") that are not talking."""
    if not asr:
        return []
    spans = sorted((s["start"], s["end"]) for s in asr.get("transcript", [])
                   if s.get("digit_density", 1.0) < 0.5 and s["end"] - s["start"] >= min_len_s)
    out: list[list[float]] = []
    for a, b in spans:
        if out and a - out[-1][1] <= min_gap_s:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([round(a, 3), round(b, 3)])
    return [[round(a, 3), round(b, 3)] for a, b in out]


def _beats_from_cycles(count1: list[float], cycle_len: float, duration: float) -> list[float]:
    """8 evenly spaced counts per detected cycle. Across a pause (gap much longer
    than a cycle) only the first cycle length is filled, so no counts are invented
    while the instructor talks."""
    beats: list[float] = []
    for i, t1 in enumerate(count1):
        nxt = count1[i + 1] if i + 1 < len(count1) else None
        span = (nxt - t1) if nxt is not None and (nxt - t1) <= 1.6 * cycle_len else cycle_len
        step = span / 8.0
        for k in range(8):
            t = t1 + k * step
            if t < duration and (nxt is None or t < nxt):
                beats.append(round(t, 3))
    return beats


def build(phase: dict, beats: dict, media: dict) -> dict:
    duration = float(media["duration_s"])
    base = {"duration_s": round(duration, 3), "speech_spans": _speech_spans(phase.get("asr"))}

    if phase.get("ok") and phase.get("method") == "spoken_counts" and phase.get("count1_times"):
        count1 = [round(float(t), 3) for t in phase["count1_times"]]
        cycle_len = float(phase.get("cycle_len_s") or (np.median(np.diff(count1)) if len(count1) > 1 else 0.0))
        if cycle_len <= 0:
            cycle_len = 4.8
        beat_times = _beats_from_cycles(count1, cycle_len, duration)
        bar_times = [t for i, t in enumerate(beat_times) if i % 4 == 0]
        return {**base, "mode": "counting", "confidence": round(float(phase.get("confidence", 0.0)), 3),
                "count_period_s": round(cycle_len / 8.0, 4), "count1_times": count1,
                "bar_times": bar_times, "beat_times": beat_times, "ambiguous_1_vs_5": False}

    if beats.get("ok"):
        grid = [round(float(t), 3) for t in beats["grid_beats"]]
        k0 = int(beats.get("grid_index_start", 0))
        ph = int(beats.get("downbeat_phase4", 0))
        ks = range(k0, k0 + len(grid))
        bar_times = [t for k, t in zip(ks, grid) if (k - ph) % 4 == 0]
        count1 = [t for k, t in zip(ks, grid) if (k - ph) % 8 == 0]
        return {**base, "mode": "music", "confidence": round(0.3 * (0.5 + float(beats.get("downbeat_margin", 0.0)) / 2), 3),
                "count_period_s": round(float(beats["period_s"]), 4), "count1_times": count1,
                "bar_times": bar_times, "beat_times": grid, "ambiguous_1_vs_5": True}

    return {**base, "mode": "none", "confidence": 0.0, "count_period_s": None,
            "count1_times": [], "bar_times": [], "beat_times": [], "ambiguous_1_vs_5": False}


def chunks(grid: dict, counts_per_chunk: int = 8) -> list[dict]:
    """Reference implementation of the app's chunking, for tests and the report:
    consecutive runs of `counts_per_chunk` beats, aligned to count 1 where known."""
    beats = grid["beat_times"]
    if not beats:
        return []
    anchors = grid["count1_times"] if grid["mode"] == "counting" else grid["bar_times"]
    anchor_set = set(anchors)
    out: list[dict] = []
    # Music mode: the beat grid starts at the first beat, not the first bar. Align
    # chunks to bars and emit the lead-in as one partial chunk (no label).
    i = 0
    if grid["mode"] == "music" and anchors:
        first_bar = anchors[0]
        i = beats.index(first_bar) if first_bar in beats else 0
        if first_bar > 0.3:
            out.append({"start": 0.0, "end": first_bar, "count_label": None})
    while i < len(beats):
        j = i + counts_per_chunk
        # shorten the chunk if a count-1 anchor falls inside it (pause or restart)
        for k in range(i + 1, min(j, len(beats))):
            if beats[k] in anchor_set and grid["mode"] == "counting" and counts_per_chunk >= 8:
                j = k
                break
        end = beats[j] if j < len(beats) else grid["duration_s"]
        if grid.get("ambiguous_1_vs_5"):
            label = None  # music: which bar is "1" is unknown until the user taps
        else:
            label = 1 if beats[i] in set(grid["count1_times"]) else (5 if beats[i] in anchor_set else None)
        out.append({"start": beats[i], "end": round(end, 3), "count_label": label})
        i = j
    return out
