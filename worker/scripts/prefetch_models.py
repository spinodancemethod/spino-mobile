"""Download all model weights at image build time so runs work offline.

Each block is independent; a failure here fails the build on purpose, because a
missing model would otherwise fail silently at run time inside the container.
"""
from __future__ import annotations

import os

os.makedirs("/models", exist_ok=True)

print("[prefetch] Beat This! checkpoint final0")
from beat_this.inference import File2Beats  # noqa: E402

File2Beats(checkpoint_path="final0", device="cpu", dbn=False)

print("[prefetch] faster-whisper small (int8)")
from faster_whisper import WhisperModel  # noqa: E402

WhisperModel("small", device="cpu", compute_type="int8")

print("[prefetch] rtmlib Body (RTMO + RTMPose, balanced)")
import numpy as np  # noqa: E402
from rtmlib import Body  # noqa: E402

body = Body(mode="balanced", backend="onnxruntime", device="cpu")
# One dummy inference forces the ONNX downloads and warms the session.
body(np.zeros((360, 640, 3), dtype=np.uint8))

print("[prefetch] done")
