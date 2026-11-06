# Fable PoC worker — CPU-only, runs on arm64 (Apple Silicon Docker) and x86-64.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models/hf \
    TORCH_HOME=/models/torch \
    XDG_CACHE_HOME=/models/cache

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg libsndfile1 libgl1 libglib2.0-0 git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Torch first so the big wheel layer is cached independently of app deps.
RUN pip install torch==2.5.1 torchaudio==2.5.1

COPY requirements.txt .
RUN pip install -r requirements.txt

# Pre-fetch model weights so the container runs offline.
COPY scripts/prefetch_models.py scripts/prefetch_models.py
RUN python scripts/prefetch_models.py

COPY . .

ENTRYPOINT ["python", "-m", "fable.analyse"]
