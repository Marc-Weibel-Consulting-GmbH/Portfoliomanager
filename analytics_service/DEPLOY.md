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
