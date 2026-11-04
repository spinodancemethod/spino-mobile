"""Step 03: extract frames around each count-1 timestamp."""
from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image

from .config import Config


def _grab(video: Path, t: float, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    # -ss before -i seeks to the nearest keyframe then decodes forward to t,
    # which is frame-accurate for MP4 in modern ffmpeg and much faster than
    # decoding from the start.
    subprocess.check_call([
        "ffmpeg", "-y", "-v", "error", "-ss", f"{max(t, 0):.3f}", "-i", str(video),
        "-frames:v", "1", "-q:v", "2", str(out),
    ])


def _resized(src: Path, dst: Path, long_edge: int) -> None:
    with Image.open(src) as im:
        w, h = im.size
        s = long_edge / max(w, h)
        if s < 1:
            im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        im.save(dst, quality=90)


def extract(video: Path, count1_times: list[float], duration: float, out_dir: Path, cfg: Config) -> dict:
    """Returns {cycles: [{index, count1_t, frames: [{offset, t, native, api}]}]}."""
    cycles = []
    for i, c1 in enumerate(count1_times):
        frames = []
        for rnd, offsets in ((1, cfg.frame_offsets_s), (2, cfg.extra_frame_offsets_s)):
            for off in offsets:
                t = c1 + off
                if t < 0 or t > duration:
                    continue
                tag = f"c{i:03d}_{'m' if off < 0 else 'p'}{abs(off):.2f}".replace(".", "")
                native = out_dir / "frames" / f"{tag}.jpg"
                api = out_dir / "frames" / f"{tag}_api.jpg"
                _grab(video, t, native)
                _resized(native, api, cfg.api_long_edge_px)
                # round 2 frames are classified only if round 1 is not confident
                frames.append({"offset": off, "t": t, "native": str(native), "api": str(api), "round": rnd})
        cycles.append({"index": i, "count1_t": c1, "frames": frames})
    return {"cycles": cycles}


def whole_video_frames(video: Path, duration: float, out_dir: Path, cfg: Config) -> dict:
    """Fallback for the no-audio path: three frames spread across the clip."""
    frames = []
    for j, frac in enumerate((0.1, 0.5, 0.9)):
        t = duration * frac
        native = out_dir / "frames" / f"whole_{j}.jpg"
        api = out_dir / "frames" / f"whole_{j}_api.jpg"
        _grab(video, t, native)
        _resized(native, api, cfg.api_long_edge_px)
        frames.append({"offset": 0.0, "t": t, "native": str(native), "api": str(api)})
    return {"cycles": [{"index": 0, "count1_t": 0.0, "frames": frames, "whole_video": True}]}
