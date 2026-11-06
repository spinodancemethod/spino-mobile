"""Step 02: 8-count phase and count-1 timestamps.

Strategies, tried in order:
  1. spoken_counts  — digits from faster-whisper in short overlapping windows,
                      snapped to audio onsets, grouped into 8-count cycles.
                      Count-1 is derived from the digits themselves; the beat
                      grid (if any) only refines each boundary by snapping.
  2. downbeat_only  — grid present but no usable counting: assume the first
                      downbeat is count 1 (low confidence, 1-vs-5 ambiguous).
  3. no_audio       — nothing usable; caller emits one whole-video snippet.

The pure functions (normalise_digit, structural_ok, vote_phase, cycles_from_digits)
are unit-tested.
"""
from __future__ import annotations

import functools
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from .config import Config

DIGIT_WORDS = {
    "one": (1, 1.0), "1": (1, 1.0), "won": (1, 0.6),
    "two": (2, 1.0), "2": (2, 1.0), "to": (2, 0.5), "too": (2, 0.5),
    "three": (3, 1.0), "3": (3, 1.0),
    "four": (4, 1.0), "4": (4, 1.0), "for": (4, 0.5),
    "five": (5, 1.0), "5": (5, 1.0),
    "six": (6, 1.0), "6": (6, 1.0),
    "seven": (7, 1.0), "7": (7, 1.0),
    "eight": (8, 1.0), "8": (8, 1.0), "ate": (8, 0.6),
}
WINDOW_S, HOP_S = 6.0, 5.0  # short windows stop Whisper collapsing repeated counts


@dataclass
class Digit:
    value: int
    t: float
    word: str
    probability: float
    lexical_weight: float
    onset_strength: float = 0.0
    beat_index: int | None = None
    beat_offset_s: float | None = None
    accepted: bool = False
    reject_reason: str | None = None
    cycle: int | None = None


def normalise_digit(word: str) -> tuple[int, float] | None:
    w = word.strip().lower().strip(".,!?;:")
    return DIGIT_WORDS.get(w)


def digit_density(text: str) -> float:
    words = [w for w in text.replace(",", " ").split() if w.strip()]
    if not words:
        return 0.0
    return sum(1 for w in words if normalise_digit(w)) / len(words)


def structural_ok(digits: list[Digit], period: float, cfg: Config) -> tuple[bool, str]:
    """Real counting is sequential and isochronous. Hallucinated digits are not."""
    ds = sorted([d for d in digits if d.accepted], key=lambda d: d.t)
    if len(ds) < cfg.structural_min_digits:
        return False, f"only {len(ds)} accepted digits"
    best_run, run = 1, 1
    for a, b in zip(ds, ds[1:]):
        consecutive = (b.value == a.value + 1) or (a.value == 8 and b.value == 1)
        gap = b.t - a.t
        spacing_ok = any(abs(gap - m * period) <= cfg.structural_spacing_tolerance * m * period for m in (1, 2))
        run = run + 1 if (consecutive and spacing_ok) else 1
        best_run = max(best_run, run)
    if best_run < cfg.structural_min_run:
        return False, f"longest consecutive run {best_run}"
    return True, f"longest consecutive run {best_run}"


def vote_phase(digits: list[Digit]) -> tuple[int, float, list[float], float]:
    """Each accepted digit d at grid index k implies phase (k - (d-1)) mod 8."""
    bins = np.zeros(8)
    for d in digits:
        if d.accepted and d.beat_index is not None:
            w = d.probability * d.lexical_weight * (0.5 + 0.5 * d.onset_strength)
            bins[(d.beat_index - (d.value - 1)) % 8] += w
    total = bins.sum()
    if total == 0:
        return 0, 0.0, bins.tolist(), 0.0
    s = np.sort(bins)
    margin = float((s[-1] - s[-2]) / total)
    bins4 = bins[:4] + bins[4:]
    s4 = np.sort(bins4)
    margin4 = float((s4[-1] - s4[-2]) / total)
    return int(np.argmax(bins)), margin, bins.tolist(), margin4


def cycles_from_digits(digits: list[Digit], count_period: float) -> list[dict]:
    """Group accepted digits into 8-count cycles and estimate each cycle's count-1 time.

    Every digit d spoken at time t implies a count-1 at t - (d-1)*T. Digits from
    the same cycle agree on that implied time regardless of dropped, duplicated
    or mis-timed words, so we cluster the implied times (1-D, gap threshold
    0.3 cycles) and take each cluster's median. Clusters are then refined with
    their own local period from consecutive digits.
    Returns [{cycle, t1, n_digits, period, has_one}] sorted by t1.
    """
    T = count_period
    ds = sorted([d for d in digits if d.accepted], key=lambda d: d.t - (d.value - 1) * T)
    if not ds:
        return []
    clusters: list[list[Digit]] = [[ds[0]]]
    for d in ds[1:]:
        centre = float(np.median([x.t - (x.value - 1) * T for x in clusters[-1]]))
        if (d.t - (d.value - 1) * T) - centre > 0.3 * 8 * T:
            clusters.append([d])
        else:
            clusters[-1].append(d)
    out = []
    for i, g in enumerate(clusters):
        g.sort(key=lambda d: d.t)
        for d in g:
            d.cycle = i
        gaps = [(b.t - a.t) / (b.value - a.value) for a, b in zip(g, g[1:]) if b.value > a.value]
        Tl = float(np.median(gaps)) if len(gaps) >= 2 else T
        if abs(Tl - T) > 0.4 * T:  # a local estimate this far off is noise, not tempo drift
            Tl = T
        # Threshold relaxed 0.8 -> 0.6 in Prompt 6: class-recording "one"s often score 0.6-0.8.
        ones = [d for d in g if d.value == 1 and d.lexical_weight >= 1.0 and d.probability >= 0.6]
        if ones:
            # A clearly spoken "one" is the ground truth for count 1, whatever the tempo did.
            t1 = max(ones, key=lambda d: d.probability).t
            src = "spoken_one"
        else:
            t1 = float(np.median([d.t - (d.value - 1) * Tl for d in g]))
            src = "extrapolated"
        out.append({"cycle": i, "t1": t1, "n_digits": len(g), "period": Tl,
                    "has_one": any(d.value == 1 for d in g), "t1_source": src})
    out.sort(key=lambda c: c["t1"])
    return out


@functools.lru_cache(maxsize=2)
def _whisper(model_name: str, workers: int, cpu_threads: int):
    """One model per process: loading takes ~1 s per job otherwise. num_workers lets
    transcribe() run truly in parallel from several Python threads (CTranslate2
    releases the GIL)."""
    from faster_whisper import WhisperModel
    return WhisperModel(model_name, device="cpu", compute_type="int8", num_workers=workers, cpu_threads=cpu_threads)


def _speech_windows(audio: np.ndarray, sr: int, total: float) -> list[tuple[float, float]]:
    """Windows (start, end) that overlap speech according to one Silero VAD pass over
    the whole file. faster-whisper pads every chunk to 30 s before the encoder, so a
    6 s window costs as much as a 30 s one (~0.9 s on CPU); skipping the windows
    with nothing to hear is the single biggest saving (music-only clips: ~10x).
    The threshold is lower than the per-window VAD's so this pass only ever skips
    windows the old code would have transcribed to silence anyway."""
    from faster_whisper.vad import VadOptions, get_speech_timestamps
    spans = get_speech_timestamps(audio, VadOptions(threshold=0.3, min_silence_duration_ms=1000, speech_pad_ms=600), sampling_rate=sr)
    speech = [(x["start"] / sr, x["end"] / sr) for x in spans]
    out: list[tuple[float, float]] = []
    start = 0.0
    while start < total:
        end = min(total, start + WINDOW_S)
        if any(a < end and b > start for a, b in speech):
            out.append((start, end))
        start += HOP_S
    return out


def _transcribe_digits(wav: Path, cfg: Config) -> tuple[list[Digit], dict]:
    import soundfile as sf

    workers = max(1, cfg.whisper_workers)
    model = _whisper(cfg.whisper_model, workers, cfg.whisper_threads)
    audio, sr = sf.read(str(wav), dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    total = len(audio) / sr

    # One window -> (transcript rows, candidate digits, language info). Windows are
    # independent, so they run in parallel; the results are merged below in window
    # order so the "keep the first of two overlapping hits" dedupe is unchanged.
    def transcribe_window(start: float, end: float, allow_split: bool) -> tuple[list[dict], list[Digit], tuple]:
        chunk = audio[int(start * sr):int(end * sr)]
        segments, info = model.transcribe(
            chunk, language="en", beam_size=5, word_timestamps=True, vad_filter=True,
            hotwords="one two three four five six seven eight", condition_on_previous_text=False,
            # v2 Prompt 7: the default temperature fallback (0 -> 0.2 -> ... 1.0) re-decodes
            # hard windows with sampling, so identical audio gave different digit sets
            # between runs (64 vs 55 digits on one clip). Greedy/beam only: deterministic.
            temperature=0.0,
            chunk_length=cfg.whisper_chunk_s or None,
        )
        rows: list[dict] = []
        cands: list[Digit] = []
        for seg in segments:
            words = seg.words or []
            seg_len = max(1e-3, seg.end - seg.start)
            # Repetition hallucination: without the temperature fallback Whisper can
            # emit "one six seven eight" dozens of times in one segment. Counting is at
            # most ~3 words/s. A looping window is re-transcribed as two halves (shorter
            # context rarely loops); still deterministic.
            if len(words) / seg_len > 5.0:
                if allow_split and end - start > 2.0:
                    mid = (start + end) / 2
                    r1, c1, _ = transcribe_window(start, mid, False)
                    r2, c2, _ = transcribe_window(mid, end, False)
                    return r1 + r2, c1 + c2, (info.language, info.language_probability)
                continue  # second-level loop: drop the segment entirely
            s0, s1 = seg.start + start, seg.end + start
            dens = digit_density(seg.text)
            rows.append({"window_start": start, "start": s0, "end": s1, "text": seg.text,
                         "no_speech_prob": seg.no_speech_prob, "compression_ratio": seg.compression_ratio,
                         "avg_logprob": seg.avg_logprob, "digit_density": dens})
            # Repetitive counting legitimately compresses well, so only apply the
            # compression-ratio hallucination test to segments that are not mostly digits.
            seg_bad = seg.no_speech_prob > 0.5 or seg.avg_logprob < -1.0 or (seg.compression_ratio > 2.4 and dens < 0.6)
            for w in words:
                nd = normalise_digit(w.word)
                if not nd:
                    continue
                if (w.end - w.start) < 0.05:  # zero-length words come from loops
                    continue
                d = Digit(value=nd[0], t=float(w.start) + start, word=w.word.strip(), probability=float(w.probability), lexical_weight=nd[1])
                if seg_bad:
                    d.reject_reason = "segment_flagged"
                elif d.probability < cfg.digit_min_probability:
                    d.reject_reason = "low_probability"
                cands.append(d)
        return rows, cands, (info.language, info.language_probability)

    windows = _speech_windows(audio, sr, total) if cfg.vad_skip_windows else \
        [(s, min(total, s + WINDOW_S)) for s in np.arange(0.0, total, HOP_S)]
    n_total = int(np.ceil(total / HOP_S)) if total > 0 else 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(lambda w: transcribe_window(w[0], w[1], True), windows))

    digits: list[Digit] = []
    transcript: list[dict] = []
    lang, lang_p = None, None
    for rows, cands, (lg, lp) in results:
        transcript.extend(rows)
        lang, lang_p = lg, lp
        for d in cands:
            # Overlapping windows see the same word twice; keep the first.
            if any(abs(x.t - d.t) < 0.4 and x.value == d.value for x in digits):
                continue
            digits.append(d)

    # Speech seconds from the union of segment spans.
    speech_s = 0.0
    spans = sorted((t["start"], t["end"]) for t in transcript)
    cur = None
    for a, b in spans:
        if cur and a <= cur[1]:
            cur = (cur[0], max(cur[1], b))
        else:
            if cur:
                speech_s += cur[1] - cur[0]
            cur = (a, b)
    if cur:
        speech_s += cur[1] - cur[0]
    digits.sort(key=lambda d: d.t)
    meta = {"language": lang, "language_probability": lang_p, "speech_seconds": speech_s,
            "window_s": WINDOW_S, "hop_s": HOP_S, "windows_transcribed": len(windows), "windows_total": n_total,
            "transcript": transcript}
    return digits, meta


def _snap_to_onsets(digits: list[Digit], wav: Path, cfg: Config) -> None:
    import librosa

    y, sr = librosa.load(str(wav), sr=16000, mono=True)
    env = librosa.onset.onset_strength(y=y, sr=sr)
    times = librosa.times_like(env, sr=sr)
    env_n = env / (env.max() or 1.0)
    for d in digits:
        lo, hi = d.t - cfg.onset_snap_window_s, d.t + cfg.onset_snap_window_s
        m = (times >= lo) & (times <= hi)
        if m.any():
            i = np.argmax(np.where(m, env_n, -1))
            d.t = float(times[i])
            d.onset_strength = float(env_n[i])


def _count_period(digits: list[Digit]) -> float | None:
    acc = sorted([d for d in digits if d.reject_reason is None], key=lambda d: d.t)
    gaps = [(b.t - a.t) / (b.value - a.value) for a, b in zip(acc, acc[1:]) if 0 < b.value - a.value <= 2 and 0.2 < b.t - a.t < 2.5]
    return float(np.median(gaps)) if len(gaps) >= 3 else None


def _rescue_structural_digits(digits: list[Digit], count_period: float) -> int:
    """Accept a low-probability digit when an accepted neighbour predicts it.

    Whisper's per-word probability for short digits is often < 0.5 even when the
    word is exactly where the sequence says it should be (Prompt 6: 37 of 84
    digits rejected on one clip). A digit d at time t is rescued if an accepted
    digit with value d±1 sits one count away (±45%), or d±2 two counts away.
    Returns the number rescued.
    """
    acc = [d for d in digits if d.accepted]
    n = 0
    for d in digits:
        if d.accepted or d.reject_reason != "low_probability":
            continue
        for a in acc:
            dv = d.value - a.value
            if dv == 0 or abs(dv) > 2:
                continue
            expected = a.t + dv * count_period
            if abs(d.t - expected) <= 0.45 * count_period * abs(dv):
                d.accepted = True
                d.reject_reason = "low_probability_rescued"
                n += 1
                break
    return n


def bar_times_from_count1(count1: list[float], cycle_len_s: float, duration_s: float) -> list[float]:
    """Interleave count-5 times (half a cycle after each count 1) with the count-1
    times, so positions can be scanned every 4 counts. Pure; keeps order; drops
    anything past the end of the video."""
    out: list[float] = []
    for i, t1 in enumerate(count1):
        out.append(t1)
        nxt = count1[i + 1] if i + 1 < len(count1) else t1 + cycle_len_s
        t5 = t1 + (nxt - t1) / 2.0  # midpoint of this cycle, robust to slight tempo drift
        if t5 < duration_s and t5 < nxt:
            out.append(t5)
    return out


def estimate(audio_wav: Path | None, beats: dict, media: dict, cfg: Config) -> dict:
    attempts: list[dict] = []
    duration = media["duration_s"]
    if not media["has_audio"] or audio_wav is None:
        return {"method": "no_audio", "ok": False, "reason": "no audio stream", "count1_times": [], "attempts": attempts}

    has_grid = beats.get("ok", False)
    digits, meta = _transcribe_digits(audio_wav, cfg)
    _snap_to_onsets(digits, audio_wav, cfg)

    # Period per count: from the digits when possible, else from the beat grid.
    Tc = _count_period(digits)
    Tg = beats["period_s"] if has_grid else None
    T = Tc or Tg
    counting_on_half_beats = bool(Tc and Tg and abs(Tc - 2 * Tg) < 0.15 * Tc)

    for d in digits:
        if d.reject_reason is None:
            d.accepted = True
    if T:
        _rescue_structural_digits(digits, T)
    for d in digits:
        if has_grid:
            k = int(np.round((d.t - beats["grid_t0"]) / Tg))
            d.beat_index = k
            d.beat_offset_s = float(d.t - (beats["grid_t0"] + k * Tg))

    structural, why = (structural_ok(digits, T, cfg) if T else (False, "no period"))
    if structural:
        all_cycles = cycles_from_digits(digits, T)
        # A cluster of one digit is usually a mis-heard word; use it only if nothing better exists.
        cycles = [c for c in all_cycles if c["n_digits"] >= 2] or all_cycles
        # Prompt 6: real class counting is not metronomic. The instructor stops,
        # talks, and restarts, so boundaries come from detected cycles only.
        # Interpolate a missing cycle only when a gap is ~2 cycles wide (words were
        # missed); never invent boundaries across longer gaps or extend past the
        # last detected cycle. Leading time before the first cycle is left to the
        # merge step (the first snippet starts at 0 anyway).
        t1s = [c["t1"] for c in cycles]
        cycle_len = float(np.median(np.diff(t1s))) if len(t1s) > 1 else 8 * T
        filled: list[float] = []
        interpolated = 0
        talk = [(s["start"], s["end"]) for s in meta.get("transcript", []) if s.get("digit_density", 1.0) < 0.5 and s["end"] - s["start"] >= 1.0]
        for t in t1s:
            if filled:
                gap = t - filled[-1]
                # A ~2-cycle gap means a cycle's words were missed, unless the
                # instructor was talking in it (v2 Prompt 7: 19.5->28.8 s on one clip
                # was a spoken explanation, not a missed cycle).
                talking_in_gap = any(a < t and b > filled[-1] for a, b in talk)
                if abs(gap - 2 * cycle_len) <= 0.2 * cycle_len and not talking_in_gap:
                    filled.append(filled[-1] + gap / 2)
                    interpolated += 1
            filled.append(t)
        if filled and filled[0] - cycle_len >= -0.25 * cycle_len:
            filled.insert(0, max(0.0, filled[0] - cycle_len))  # one partial leading cycle at most
        count1 = [max(0.0, t) for t in filled if t < duration]
        # No snapping to the beat grid: videos are either music or counting (user,
        # 2026-11-01). On counting clips the tracker locks onto the voice (69-94 BPM)
        # and snapping to that grid moved correct boundaries (Prompt 6).
        snapped = 0
        # Keep boundaries sorted and at least half a cycle apart.
        count1 = sorted(set(count1))
        count1 = [t for i, t in enumerate(count1) if i == 0 or t - count1[i - 1] >= 0.5 * cycle_len]
        phase8, margin, bins, margin4 = vote_phase(digits) if has_grid else (0, 0.0, [], 0.0)
        conf = min(1.0, 0.6 + 0.1 * min(4, len(cycles)) * (sum(c["has_one"] for c in cycles) / len(cycles)))
        attempts.append({"method": "spoken_counts", "ok": True, "structural": why, "count_period_s": T,
                         "cycles_detected": len(cycles), "count1_interpolated": len(count1) - len(cycles),
                         "grid_snapped": snapped, "phase8": phase8, "margin": margin, "margin4": margin4, "bins": bins,
                         "accepted": sum(d.accepted for d in digits), "total_digits": len(digits),
                         "counting_on_half_beats": counting_on_half_beats})
        return {"method": "spoken_counts", "ok": True, "phase8": int(phase8), "confidence": float(conf),
                "ambiguous_1_vs_5": False, "count1_times": count1, "cycle_len_s": cycle_len,
                "bar_times": bar_times_from_count1(count1, cycle_len, media["duration_s"]),
                "digit_cycles": cycles, "weak_cycles": [c for c in all_cycles if c not in cycles],
                "digits": [asdict(d) for d in digits], "asr": meta, "attempts": attempts}

    attempts.append({"method": "spoken_counts", "ok": False, "structural": why,
                     "accepted": sum(d.accepted for d in digits), "total_digits": len(digits)})
    if has_grid:
        phase = beats["downbeat_phase4"]
        conf = 0.3 * (0.5 + beats["downbeat_margin"] / 2)
        k0 = beats["grid_index_start"]
        ks_grid = list(zip(range(k0, k0 + len(beats["grid_beats"])), beats["grid_beats"]))
        count1 = [t for k, t in ks_grid if (k - phase) % 8 == 0]
        # Every bar start (count 1 or 5). With no spoken counts we cannot tell which
        # half is "1", so the caller scans positions at every bar instead (user
        # decision 2026-11-01) and the 1-vs-5 question only affects labelling.
        bars = [t for k, t in ks_grid if (k - phase) % 4 == 0]
        attempts.append({"method": "downbeat_only", "ok": True, "phase8": phase, "note": "first downbeat assumed to be count 1"})
        return {"method": "downbeat_only", "ok": True, "phase8": int(phase), "confidence": float(conf),
                "ambiguous_1_vs_5": True, "count1_times": count1, "bar_times": bars,
                "digits": [asdict(d) for d in digits], "asr": meta, "attempts": attempts}

    attempts.append({"method": "no_audio", "ok": False,
                     "reason": f"no grid; speech {meta['speech_seconds']:.1f}s; digits {len(digits)}"})
    return {"method": "no_audio", "ok": False, "reason": "no usable rhythm or counting",
            "count1_times": [], "digits": [asdict(d) for d in digits], "asr": meta, "attempts": attempts}
