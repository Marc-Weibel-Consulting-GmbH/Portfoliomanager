# analytics_service – Deployment

Python FastAPI microservice for risk metrics, DCF, optimization and **ML
pre-training** (GradientBoosting → ONNX). The TS server calls it via
`ANALYTICS_SERVICE_URL`.

## Deploy (any container host)

```bash
# build & run locally
docker build -t pm-analytics ./analytics_service
docker run -p 8001:8001 pm-analytics
curl localhost:8001/health   # -> {"status":"ok"} (or similar)
```

On Railway / Render / Fly.io / Cloud Run: point the service at
`analytics_service/Dockerfile`. The platform's `$PORT` is used automatically.

## Deploy on Railway (step by step)

A `railway.json` next to this file already pins the Dockerfile build + the
`/health` check, so the only manual setting is the service **root directory**.

1. Railway → **New Project → Deploy from GitHub repo** → pick this repository.
2. Open the created service → **Settings → Root Directory** → set it to
   `analytics_service`. Railway then picks up `analytics_service/Dockerfile`
   and `railway.json` automatically.
3. Deploy. Railway injects `PORT`; the container's healthcheck hits `/health`.
   Once green, copy the service's public URL (**Settings → Networking →
   Generate Domain** if none is shown yet).
4. Verify: `curl https://<railway-host>/health` → `{"status":"ok", ...}`.

**Note on data access:** this service uses `yfinance` / `tradingview-ta`.
Railway has open outbound egress, so those work there even though Yahoo is
blocked on the main app's proxy — the Python service is a separate network path.

## Wire it to the app

## Wire it to the app

Set in the **Node/TS** app environment:

```
ANALYTICS_SERVICE_URL=https://<deployed-analytics-host>
```

## Endpoints used by the app
- `POST /analytics/train` – ML pre-training (called by the weekly cron and by `pnpm ml:train`)
- `GET  /health`

## Trigger a training run (after deploy + `pnpm db:push`)
```
pnpm ml:train      # one-off run, instead of waiting for the weekly cron
```
