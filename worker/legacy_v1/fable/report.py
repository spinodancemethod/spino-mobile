"""Step 07: self-contained HTML debug report."""
from __future__ import annotations

import base64
import io
import json
import shutil
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from PIL import Image

TEMPLATES = Path(__file__).resolve().parent.parent / "templates"


def _thumb(path: str | None, long_edge: int = 320) -> str:
    if not path or not Path(path).exists():
        return ""
    with Image.open(path) as im:
        w, h = im.size
        s = long_edge / max(w, h)
        if s < 1:
            im = im.resize((round(w * s), round(h * s)))
        buf = io.BytesIO()
        im.convert("RGB").save(buf, format="JPEG", quality=70)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def render(run_dir: Path, video: Path, media: dict, beats: dict, phase: dict, predictions: dict,
           snippets: list[dict], timings: dict, lib: dict) -> Path:
    # Copy the video next to the report so <video> can play it offline.
    local_video = run_dir / ("video" + video.suffix)
    if not local_video.exists():
        shutil.copy(video, local_video)
    env = Environment(loader=FileSystemLoader(str(TEMPLATES)), autoescape=True)
    env.filters["thumb"] = _thumb
    env.filters["tojson_pretty"] = lambda o: json.dumps(o, indent=2, default=str)
    html = env.get_template("report.html").render(
        media=media, beats=beats, phase=phase, predictions=predictions, snippets=snippets,
        timings=timings, lib=lib, video_name=local_video.name,
        names={p["id"]: p["name"] for p in lib["positions"]} | {lib["fallback_id"]: "Needs review"},
    )
    out = run_dir / "report.html"
    out.write_text(html)
    return out
