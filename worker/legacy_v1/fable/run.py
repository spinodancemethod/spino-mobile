"""CLI: run the Fable pipeline on one video.

  python -m fable.run --video /media/x.mp4 --out /runs/x [--from STEP] [--no-classify]

Simplified pipeline (user decision 2026-11-01):
  probe -> rhythm -> phase (find the count-1 times) -> frames (one per 8-count, at
  count 1) -> classify (Haiku names the position) -> merge (unclear cycles continue
  the previous snippet) -> report.
Music-only clips cannot resolve count 1 vs 5 from audio, so they become one
low-confidence snippet of `music_fallback_position` for the user to refine.
Output: timestamps + position id per snippet, for a video that stays on the phone.

Every step writes its JSON to the run directory before the next starts, and
--from re-runs from a step using the saved outputs of earlier steps.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

from . import classify, frames, media, merge, phase, pose, report, rhythm
from .config import Config

STEPS = ["probe", "rhythm", "phase", "frames", "pose", "classify", "merge", "report"]


def _save(run_dir: Path, name: str, obj) -> None:
    (run_dir / f"{name}.json").write_text(json.dumps(obj, indent=2, default=str))


def _load(run_dir: Path, name: str):
    return json.loads((run_dir / f"{name}.json").read_text())


def _music_only(p: dict) -> bool:
    """Beat grid found but no spoken counts: phase (1 vs 5) is unknown."""
    return bool(p.get("ok")) and p.get("method") == "downbeat_only"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--positions", type=Path, default=Path("/app/positions/positions.json"))
    ap.add_argument("--from", dest="from_step", choices=STEPS, default="probe")
    ap.add_argument("--no-classify", action="store_true", help="skip the API")
    ap.add_argument("--offsets", type=str, default=None, help="frame offsets in seconds from count 1, e.g. 0,0.25")
    ap.add_argument("--offsets-counts", type=str, default=None, help="frame offsets in COUNTS from count 1, e.g. -1 (the beat before)")
    ap.add_argument("--pose", action="store_true", help="run RTMPose (off by default)")
    ap.add_argument("--multi", action="store_true", help="send all first-round frames in one call (strip across the 8-count)")
    ap.add_argument("--model", type=str, default=None, help="primary classification model id (default claude-haiku-5-5)")
    ap.add_argument("--long-edge", type=int, default=None, help="API image long edge in px (default 768)")
    ap.add_argument("--min-cycles", type=int, default=1)
    ap.add_argument("--lead-in", type=float, default=0.0)
    ap.add_argument("--max-seconds", type=float, default=180.0)
    args = ap.parse_args(argv)

    cfg = Config(video=args.video, out=args.out, positions_file=args.positions,
                 classify=not args.no_classify, min_cycles_to_switch=args.min_cycles,
                 lead_in_s=args.lead_in, max_video_seconds=args.max_seconds, use_pose=args.pose,
                 multi_frame_call=args.multi)
    if args.model:
        cfg.primary_model = args.model
    if args.long_edge:
        cfg.api_long_edge_px = args.long_edge
    if args.offsets:
        cfg.frame_offsets_s = tuple(float(x) for x in args.offsets.split(","))
    if args.offsets_counts:
        cfg.frame_offsets_counts = tuple(float(x) for x in args.offsets_counts.split(","))
    run_dir = cfg.out
    run_dir.mkdir(parents=True, exist_ok=True)
    start_at = STEPS.index(args.from_step)
    timings = _load(run_dir, "timings") if (run_dir / "timings.json").exists() and start_at > 0 else {}

    def do(step: str) -> bool:
        return STEPS.index(step) >= start_at

    def timed(step, fn):
        t = time.time()
        r = fn()
        timings[step] = round(time.time() - t, 2)
        _save(run_dir, "timings", timings)
        print(f"[{step}] {timings[step]:.1f}s", file=sys.stderr)
        return r

    # 00 probe
    if do("probe"):
        m = timed("probe", lambda: media.probe(cfg.video))
        if m["duration_s"] > cfg.max_video_seconds:
            print(f"video is {m['duration_s']:.0f}s, over the {cfg.max_video_seconds:.0f}s cap", file=sys.stderr)
            return 2
        _save(run_dir, "media", m)
    m = _load(run_dir, "media")
    wav = run_dir / "audio.wav"
    if m["has_audio"] and not wav.exists():
        media.extract_audio(cfg.video, wav)

    # 01 rhythm
    if do("rhythm"):
        b = timed("rhythm", lambda: rhythm.track(wav, m["duration_s"], cfg) if m["has_audio"] else {"ok": False, "reason": "no audio", "flags": []})
        _save(run_dir, "beats", b)
    b = _load(run_dir, "beats")

    # 02 phase
    if do("phase"):
        p = timed("phase", lambda: phase.estimate(wav if m["has_audio"] else None, b, m, cfg))
        _save(run_dir, "phase", p)
    p = _load(run_dir, "phase")

    counting = bool(p.get("ok")) and p.get("method") == "spoken_counts" and p.get("count1_times")
    mode = "counting" if counting else ("music" if _music_only(p) else "no_audio")

    # 03 frames — one per 8-count at count 1 (counting mode only)
    if do("frames"):
        if counting:
            if cfg.frame_offsets_counts and p.get("cycle_len_s"):
                per = p["cycle_len_s"] / 8.0
                cfg.frame_offsets_s = tuple(c * per for c in cfg.frame_offsets_counts)
            times = p["bar_times"] if (cfg.scan_every_bar and p.get("bar_times")) else p["count1_times"]
            f = timed("frames", lambda: frames.extract(cfg.video, times, m["duration_s"], run_dir, cfg))
            c1 = set(round(t, 3) for t in p["count1_times"])
            for cyc in f["cycles"]:
                cyc["count"] = 1 if round(cyc["count1_t"], 3) in c1 else 5
        else:
            # music-only or no audio: no per-cycle frames; a few thumbnails for the report only
            f = timed("frames", lambda: frames.whole_video_frames(cfg.video, m["duration_s"], run_dir, cfg))
        f["mode"] = mode
        _save(run_dir, "frames", f)
    f = _load(run_dir, "frames")

    # 04 pose (optional)
    if do("pose"):
        if cfg.use_pose and counting:
            ps = timed("pose", lambda: pose.run(f, run_dir, cfg))
        else:
            ps = f  # frames pass straight through without pose features
            timings["pose"] = 0.0
        _save(run_dir, "pose", ps)
    ps = _load(run_dir, "pose")

    # 05 classify
    lib = classify.load_library(cfg.positions_file)
    if do("classify"):
        if not counting:
            # Whole clip = one low-confidence snippet of the fallback position.
            reason = "music only: count 1 vs 5 cannot be resolved from audio" if mode == "music" else "no usable audio"
            pr = {"cycles": [{"index": 0, "count1_t": 0.0, "count": None, "whole_video": True, "frames": ps["cycles"][0]["frames"],
                              "label": cfg.music_fallback_position if mode == "music" else lib["fallback_id"],
                              "confidence": 0.2, "needs_review": True, "note": reason, "escalation": None, "used_round2": False, "tally": {}}],
                  "total_cost_usd": 0.0, "primary_model": None, "mode": mode}
            timings["classify"] = 0.0
        elif cfg.classify and os.environ.get("ANTHROPIC_API_KEY"):
            pr = timed("classify", lambda: classify.run(ps, lib, run_dir, cfg, cfg.positions_file.parent))
            pr["mode"] = mode
        else:
            if cfg.classify:
                print("ANTHROPIC_API_KEY not set; dry run", file=sys.stderr)
            pr = timed("classify", lambda: classify.run_without_api(ps))
            pr["mode"] = mode
        _save(run_dir, "predictions", pr)
    pr = _load(run_dir, "predictions")

    # 06 merge
    if do("merge"):
        sn = timed("merge", lambda: merge.merge(pr["cycles"], m["duration_s"], cfg.min_cycles_to_switch, cfg.lead_in_s))
        _save(run_dir, "snippets", sn)
    sn = _load(run_dir, "snippets")

    # 07 report
    out = timed("report", lambda: report.render(run_dir, cfg.video, m, b, p, pr, sn, timings, lib))
    print(f"report: {out}", file=sys.stderr)
    # The production contract: mode, then (start, end, position_id, confidence) per snippet.
    print(json.dumps({"mode": mode,
                      "snippets": [{"start": s["start"], "end": s["end"], "position_id": s["position_id"],
                                    "confidence": s["confidence"], "needs_review": s["needs_review"]} for s in sn],
                      "cost_usd": pr.get("total_cost_usd", 0), "seconds": round(sum(timings.values()), 1)}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
