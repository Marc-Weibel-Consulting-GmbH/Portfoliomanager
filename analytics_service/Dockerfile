# Python analytics microservice (risk metrics, DCF, optimize, ML training/ONNX).
# Deploy on any container host (Railway / Render / Fly.io / Cloud Run / ECS).
# The TS server reaches it via ANALYTICS_SERVICE_URL.
FROM python:3.11-slim

# Build deps for numpy/scipy/scikit-learn/onnx wheels (mostly prebuilt, but keep gcc as a fallback).
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first for better layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code.
COPY . .

# Most platforms inject $PORT; fall back to 8001 locally.
ENV ANALYTICS_PORT=8001
EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT:-8001}/health" || exit 1

# Use $PORT when the platform sets it, else ANALYTICS_PORT/8001.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-${ANALYTICS_PORT:-8001}}"]
