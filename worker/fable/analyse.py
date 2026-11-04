"""v2 CLI: audio (or video) in, count grid out. No frames, no vision, no API.

  python -m fable.analyse --input /media/x.mp4 --out /runs/x
  python -m fable.analyse --input /jobs/123.wav --out /runs/123 --duration 66.7

Writes <out>/grid.json (the app's contract, spec v2 §3), plus beats.json and
phase.json for diagnostics, and prints grid.json to stdout.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

from . import grid, media, phase, rhythm
from .config import Config


def _audio_duration(path: Path) -> float:
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)])
    return float(json.loads(out)["format"]["duration"])


def analyse(input_path: Path, out_dir: Path, duration_s: float | None = None, keep_audio: bool = True) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    timings: dict[str, float] = {}
    t = time.time()
    is_audio = input_path.suffix.lower() in {".wav", ".m4a", ".aac", ".mp3", ".ogg", ".flac"}
    if is_audio:
        m = {"has_audio": True, "duration_s": duration_s or _audio_duration(input_path), "width": None, "height": None}
    else:
        m = media.probe(input_path)
    wav = out_dir / "audio.wav"
    if m["has_audio"]:
        media.extract_audio(input_path, wav)  # also normalises uploaded audio to 16 kHz mono
    timings["audio"] = round(time.time() - t, 2)

    cfg = Config(video=input_path, out=out_dir)
    t = time.time()
    b = rhythm.track(wav, m["duration_s"], cfg) if m["has_audio"] else {"ok": False, "reason": "no audio", "flags": []}
    timings["rhythm"] = round(time.time() - t, 2)
    t = time.time()
    p = phase.estimate(wav if m["has_audio"] else None, b, m, cfg)
    timings["phase"] = round(time.time() - t, 2)

    g = grid.build(p, b, m)
    g["timings"] = timings
    (out_dir / "beats.json").write_text(json.dumps(b, indent=2, default=str))
    (out_dir / "phase.json").write_text(json.dumps(p, indent=2, default=str))
    (out_dir / "grid.json").write_text(json.dumps(g, indent=2))
    if not keep_audio and wav.exists():
        wav.unlink()
    return g


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, type=Path, help="video or audio file")
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--duration", type=float, default=None, help="seconds; required only if the audio file has no header duration")
    ap.add_argument("--delete-audio", action="store_true", help="remove the extracted wav afterwards")
    args = ap.parse_args(argv)
    g = analyse(args.input, args.out, args.duration, keep_audio=not args.delete_audio)
    print(json.dumps(g, indent=2))
    print(f"[grid] mode={g['mode']} count1={len(g['count1_times'])} bars={len(g['bar_times'])} "
          f"beats={len(g['beat_times'])} speech={len(g['speech_spans'])} "
          f"time={sum(g['timings'].values()):.0f}s", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
