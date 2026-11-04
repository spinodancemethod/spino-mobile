"""Step 00: probe the video and extract a 16 kHz mono WAV."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path


def probe(video: Path) -> dict:
    cmd = [
        "ffprobe", "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", str(video),
    ]
    data = json.loads(subprocess.check_output(cmd))
    v = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in data["streams"] if s["codec_type"] == "audio"), None)
    fps = None
    if v and v.get("r_frame_rate"):
        n, d = v["r_frame_rate"].split("/")
        fps = float(n) / float(d) if float(d) else None
    return {
        "path": str(video),
        "duration_s": float(data["format"]["duration"]),
        "size_bytes": int(data["format"]["size"]),
        "width": int(v["width"]) if v else None,
        "height": int(v["height"]) if v else None,
        "fps": fps,
        "video_codec": v["codec_name"] if v else None,
        "has_audio": a is not None,
        "audio_codec": a["codec_name"] if a else None,
        "audio_sample_rate": int(a["sample_rate"]) if a else None,
    }


def extract_audio(video: Path, wav: Path) -> Path:
    wav.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call([
        "ffmpeg", "-y", "-v", "error", "-i", str(video),
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav),
    ])
    return wav
