"""v2 job loop: poll `analysis_jobs`, analyse the uploaded audio, write the count
grid back, delete the audio. Talks to Supabase over REST with the service role key.

  python -m fable.worker            # loops forever
  python -m fable.worker --once     # process at most one job and exit (tests / cron)

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WORKER_ID (default hostname),
POLL_INTERVAL_SECONDS (default 5), ANALYSIS_BUCKET (default analysis-audio).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import sys
import tempfile
import time
import traceback
from pathlib import Path

import httpx

from .analyse import analyse


def warm_up() -> None:
    """Pay the one-off costs before the first job: Whisper load (~1 s), Beat This!
    load (~1 s) and librosa's numba JIT in the onset snap (~6 s). Measured: a cold
    first job was ~8 s slower than the ones after it."""
    import numpy as np
    import soundfile as sf
    from . import phase, rhythm
    from .config import Config
    t = time.time()
    tmp = Path(tempfile.gettempdir()) / "fable-warmup.wav"
    sf.write(tmp, np.zeros(16000, dtype="float32"), 16000)
    cfg = Config(video=tmp, out=tmp.parent)
    phase._whisper(cfg.whisper_model, max(1, cfg.whisper_workers), cfg.whisper_threads)
    rhythm._file2beats()
    phase._snap_to_onsets([phase.Digit(value=1, t=0.5, word="one", probability=1.0, lexical_weight=1.0)], tmp, cfg)
    tmp.unlink(missing_ok=True)
    print(f"[worker] warm-up done in {time.time() - t:.1f}s (whisper={cfg.whisper_model}, workers={cfg.whisper_workers}, threads={cfg.whisper_threads})", file=sys.stderr)

BUCKET = os.environ.get("ANALYSIS_BUCKET", "analysis-audio")
MAX_AUDIO_BYTES = 20 * 1024 * 1024
MAX_DURATION_S = 180.0


class Supabase:
    """Minimal PostgREST + Storage client with the service role (bypasses RLS)."""

    def __init__(self, url: str, key: str):
        self.url = url.rstrip("/")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}
        self.c = httpx.Client(timeout=60)

    def rpc(self, fn: str, params: dict):
        r = self.c.post(f"{self.url}/rest/v1/rpc/{fn}", headers={**self.h, "Content-Type": "application/json"}, json=params)
        r.raise_for_status()
        return r.json() if r.content else None

    def download(self, path: str, dest: Path) -> int:
        with self.c.stream("GET", f"{self.url}/storage/v1/object/{BUCKET}/{path}", headers=self.h) as r:
            r.raise_for_status()
            n = 0
            with open(dest, "wb") as f:
                for chunk in r.iter_bytes():
                    n += len(chunk)
                    if n > MAX_AUDIO_BYTES:
                        raise ValueError("audio larger than limit")
                    f.write(chunk)
        return n

    def delete(self, path: str) -> None:
        r = self.c.delete(f"{self.url}/storage/v1/object/{BUCKET}/{path}", headers=self.h)
        # 404 is fine: already gone.
        if r.status_code not in (200, 204, 404):
            r.raise_for_status()

    def list_objects(self, prefix: str = "", limit: int = 1000) -> list[dict]:
        r = self.c.post(f"{self.url}/storage/v1/object/list/{BUCKET}", headers={**self.h, "Content-Type": "application/json"},
                        json={"prefix": prefix, "limit": limit, "offset": 0, "sortBy": {"column": "created_at", "order": "asc"}})
        r.raise_for_status()
        return r.json()


def sweep_old_audio(sb: Supabase, max_age_s: float = 24 * 3600) -> int:
    """Delete any audio older than the contract allows (24 h). Normal jobs delete
    their own file; this catches uploads whose job was never created or whose
    worker died before the finally block ran. Folders are per user id."""
    import datetime as dt
    now = dt.datetime.now(dt.timezone.utc)
    removed = 0
    for folder in sb.list_objects(""):
        if folder.get("id") is not None:  # a file at the root; unexpected, treat like any other
            objs = [folder]
            prefix = ""
        else:
            prefix = folder["name"] + "/"
            objs = sb.list_objects(prefix)
        for o in objs:
            created = o.get("created_at")
            if not created:
                continue
            age = (now - dt.datetime.fromisoformat(created.replace("Z", "+00:00"))).total_seconds()
            if age > max_age_s:
                sb.delete(prefix + o["name"])
                removed += 1
    return removed


def process_job(sb: Supabase, job: dict, work_root: Path) -> None:
    job_id = job["id"]
    audio_path = job["audio_path"]
    work = work_root / job_id
    work.mkdir(parents=True, exist_ok=True)
    try:
        src = work / ("input" + Path(audio_path).suffix.lower())
        size = sb.download(audio_path, src)
        duration = job.get("duration_seconds")
        if duration and float(duration) > MAX_DURATION_S:
            raise ValueError(f"video is {float(duration):.0f}s, over the {MAX_DURATION_S:.0f}s cap")
        print(f"[job {job_id}] {size} bytes, analysing", file=sys.stderr)
        grid = analyse(src, work, duration_s=float(duration) if duration else None, keep_audio=False)
        grid.pop("timings", None)
        sb.rpc("finish_analysis_job", {"p_job_id": job_id, "p_grid": grid, "p_error": None})
        print(f"[job {job_id}] done: mode={grid['mode']} count1={len(grid['count1_times'])}", file=sys.stderr)
    except Exception as e:  # noqa: BLE001 - any failure is recorded on the job
        msg = f"{type(e).__name__}: {e}"
        print(f"[job {job_id}] failed: {msg}\n{traceback.format_exc()}", file=sys.stderr)
        try:
            sb.rpc("finish_analysis_job", {"p_job_id": job_id, "p_grid": None, "p_error": msg})
        except Exception as e2:  # noqa: BLE001
            print(f"[job {job_id}] could not record failure: {e2}", file=sys.stderr)
    finally:
        # The audio is transient by contract: delete it whatever happened.
        try:
            sb.delete(audio_path)
        except Exception as e3:  # noqa: BLE001
            print(f"[job {job_id}] could not delete audio {audio_path}: {e3}", file=sys.stderr)
        shutil.rmtree(work, ignore_errors=True)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    args = ap.parse_args(argv)
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required", file=sys.stderr)
        return 2
    worker_id = os.environ.get("WORKER_ID") or socket.gethostname()
    interval = float(os.environ.get("POLL_INTERVAL_SECONDS", "5"))
    sb = Supabase(url, key)
    work_root = Path(tempfile.gettempdir()) / "fable-jobs"
    print(f"[worker {worker_id}] polling every {interval:.0f}s", file=sys.stderr)
    try:
        warm_up()
    except Exception as e:  # noqa: BLE001 - warm-up is an optimisation only
        print(f"[worker] warm-up failed (continuing): {e}", file=sys.stderr)
    last_maintenance = 0.0
    while True:
        # Maintenance every 10 minutes (and on start): requeue jobs whose worker
        # died, fail jobs that keep crashing, delete audio older than 24 h.
        if time.time() - last_maintenance > 600:
            last_maintenance = time.time()
            try:
                n = sb.rpc("requeue_stale_analysis_jobs", {}) or 0
                swept = sweep_old_audio(sb)
                if n or swept:
                    print(f"[worker] maintenance: {n} stale jobs handled, {swept} old audio files removed", file=sys.stderr)
            except Exception as e:  # noqa: BLE001
                print(f"[worker] maintenance failed: {e}", file=sys.stderr)
        try:
            rows = sb.rpc("claim_analysis_job", {"p_worker_id": worker_id}) or []
        except Exception as e:  # noqa: BLE001
            print(f"[worker] claim failed: {e}", file=sys.stderr)
            rows = []
        if rows:
            process_job(sb, rows[0], work_root)
            if args.once:
                return 0
            continue  # drain the queue without sleeping
        if args.once:
            print("[worker] no queued jobs", file=sys.stderr)
            return 0
        time.sleep(interval)


if __name__ == "__main__":
    sys.exit(main())
