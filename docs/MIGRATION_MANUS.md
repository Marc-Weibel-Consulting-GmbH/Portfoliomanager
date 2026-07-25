# Weg von Manus — Betriebs-Migration

Kurzanleitung, um den Portfolio Manager unabhängig von Manus zu betreiben.
Es gibt zwei Abhängigkeiten: den **Basis-LLM** und das **Hosting**.

## 1. Basis-LLM (wichtig — betrifft die ganze App)

Der zentrale LLM-Aufruf `invokeLLM` (Copilot, Deep-Dive, Marktanalyse,
Wochen-Reviews und als Fallback unter den Portfolio-Texten) zeigt per Default
auf `https://forge.manus.im`. Ohne Manus-Guthaben schlägt das fehl — das ist
die häufigste Ursache für „KI-Text funktioniert nicht".

Der Endpoint ist **provider-agnostisch per Env** konfigurierbar. In den
Railway-Variablen setzen:

| Env-Variable | Zweck | Beispiel |
|---|---|---|
| `BUILT_IN_FORGE_API_URL` | Basis-URL (ohne `/v1/...`, wird angehängt) | `https://<omniroute-host>` |
| `BUILT_IN_FORGE_API_KEY` | Zugriffs-Key des Anbieters | `sk-…` |
| `BUILT_IN_FORGE_MODEL` | Modellname beim Anbieter | `llama-3.3-70b-versatile` |
| `BUILT_IN_FORGE_MAX_TOKENS` | (optional) Ausgabe-Limit | `8192` |

Empfohlene Ziele (OpenAI-kompatibel):

- **OmniRoute** (euer eigener Gateway): `BUILT_IN_FORGE_API_URL=https://<host>`,
  Modell z.B. weiter ein Gemini/Claude über den Gateway. Sauberste Lösung, da
  Routing/Fallback eingebaut.
- **Groq** (gratis): `BUILT_IN_FORGE_API_URL=https://api.groq.com/openai`,
  `BUILT_IN_FORGE_MODEL=llama-3.3-70b-versatile`, `BUILT_IN_FORGE_MAX_TOKENS=8192`.
- **OpenAI**: `BUILT_IN_FORGE_API_URL=https://api.openai.com`,
  `BUILT_IN_FORGE_MODEL=gpt-4o-mini`.

Zusätzlich (unabhängig davon) die Rollen-Modelle im Admin-Panel
„Vorschlags-Modelle" auf Manus-freie Anbieter stellen (Claude/Groq/Kimi) und
die passenden Keys unter Admin › API-Keys hinterlegen: `ANTHROPIC_API_KEY`,
`GROQ_API_KEY`, `KIMI_API_KEY`, ggf. `OMNIROUTE_URL`/`OMNIROUTE_API_KEY`.

## 2. Hosting / Deploy (Railway)

Repo liegt auf GitHub, Deploy läuft über Railway. Nötige Bausteine:

- **Build:** `pnpm build` (Vite-Client + esbuild-Server-Bundle nach `dist/`).
- **Start:** `pnpm start` (`node dist/index.js`, `NODE_ENV=production`).
- **Datenbank:** MySQL — Verbindungs-Env in Railway setzen (wie im DB-Client
  erwartet), danach einmalig `pnpm db:push` für das Schema.
- **Domain:** `www.portfolio.mw` in Railway auf den Service zeigen lassen.

### Env-Checkliste (Railway)

- LLM: `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `BUILT_IN_FORGE_MODEL`
  (+ optional `BUILT_IN_FORGE_MAX_TOKENS`), sowie `KIMI_API_KEY`.
- Marktdaten: `EODHD_API_KEY`.
- Weitere je nach genutzten Features: `STRIPE_SECRET_KEY`, `RESEND_API_KEY`,
  Twilio-Variablen, `OWNER_OPEN_ID`/`OWNER_NAME`.
- Provider-Keys für die Vorschlags-Modelle liegen in der DB (Admin › API-Keys),
  nicht zwingend als Env.

> Hinweis: „Done" heisst weiterhin verifiziert live — nach jeder Änderung die
> betroffenen Seiten auf der Live-URL ohne Konsolenfehler gegenprüfen.

## 3. Secrets-Vollliste zum Abhaken (Railway)

Alle Werte werden am einfachsten als **Railway-Umgebungsvariablen** gesetzt
(gleiche Namen). Grund: `getSecret()` liest zuerst `process.env`, dann erst die
DB — Env deckt damit auch die im Code über `getSecret` gelesenen Keys ab.

### A. Kritisch — App läuft ohne diese nicht

| ✔ | Variable | Zweck | Achtung |
|---|---|---|---|
| ☐ | `DATABASE_URL` | MySQL-Verbindung | **Railway-eigene** URL, nicht Manus' |
| ☐ | `JWT_SECRET` | Login/Sessions | muss gesetzt sein |
| ☐ | `SECRETS_ENCRYPTION_KEY` | Entschlüsselt DB-Secrets | bei DB-Übernahme **identisch** zu Manus, sonst egal |
| ☐ | `EODHD_API_KEY` | Kurse/Fundamentaldaten | Kernquelle |

### B. LLM — Manus ersetzen (sonst bleibt die Abhängigkeit)

| ✔ | Variable | Zweck | Wert |
|---|---|---|---|
| ☐ | `BUILT_IN_FORGE_API_URL` | Basis-LLM Endpoint | **nicht** forge.manus.im → Groq/OmniRoute/OpenAI |
| ☐ | `BUILT_IN_FORGE_API_KEY` | Basis-LLM Key | Key des gewählten Anbieters |
| ☐ | `BUILT_IN_FORGE_MODEL` | Basis-LLM Modell | z.B. `llama-3.3-70b-versatile` |
| ☐ | `BUILT_IN_FORGE_MAX_TOKENS` | (optional) Ausgabe-Limit | z.B. `8192` |
| ☐ | `KIMI_API_KEY` | Kimi (Moonshot) | Rollen-Modell/Fallback |
| ☐ | `ANTHROPIC_API_KEY` | Claude | via getSecret/Env |
| ☐ | `GROQ_API_KEY` | Groq (gratis) | Fallback-Kaskade |
| ☐ | `PERPLEXITY_API_KEY` | Perplexity | optionales Rollen-Modell |
| ☐ | `OMNIROUTE_URL` / `OMNIROUTE_API_KEY` / `OMNIROUTE_MODEL` | OmniRoute-Gateway | falls genutzt |
| ☐ | `ANTHROPIC_MODEL` | (optional) Claude-Modell | überschreibt Default |
| ☐ | `VITE_FRONTEND_FORGE_API_URL` | Frontend-LLM-URL (Build-Zeit) | **nicht** Manus |

### C. Infrastruktur — Railway/Upstash stellen eigene Werte

| ✔ | Variable | Zweck | Achtung |
|---|---|---|---|
| ☐ | `REDIS_URL` | Cache/Queue | Railway-Redis oder Upstash |
| ☐ | `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash REST | falls Upstash genutzt |

### D. Frontend (VITE_*) — müssen zur BUILD-Zeit gesetzt sein

| ✔ | Variable |
|---|---|
| ☐ | `VITE_APP_URL` |
| ☐ | `VITE_APP_TITLE` / `VITE_APP_ID` |
| ☐ | `VITE_STRIPE_PUBLISHABLE_KEY` |
| ☐ | `VITE_WHATSAPP_NUMBER` |

### E. Bezahlung / E-Mail — nötig, wenn Feature aktiv

| ✔ | Variable | Zweck |
|---|---|---|
| ☐ | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Abo/Bezahlung |
| ☐ | `RESEND_API_KEY` / `EMAIL_FROM` | E-Mail-Versand (Resend) |
| ☐ | `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_SECURE`/`SMTP_FROM` | E-Mail (SMTP-Alternative) |
| ☐ | `OWNER_OPEN_ID` / `OWNER_NAME` | Admin-/Owner-Zuordnung |

### F. Optional — nur für einzelne Features

| ✔ | Variable | Feature |
|---|---|---|
| ☐ | `FINNHUB_API_KEY` | Finnhub-Datenquelle |
| ☐ | `FISCAL_API_KEY` | Fiscal.ai (P/E-Historie) |
| ☐ | `FINANCIAL_DATASETS_MCP_URL` | US-Fundamentaldaten im Vorschlag |
| ☐ | `MARKET_REPORT_API_KEY` | Markt-Report-Quelle |
| ☐ | `TRADINGVIEW_MCP_URL` | TradingView-Screener |
| ☐ | `ANALYTICS_SERVICE_URL` | Analytics-Service |
| ☐ | `SORNETTE_USERNAME` / `SORNETTE_PASSWORD` | Blasen-/Sornette-Signal |
| ☐ | `WIKIFOLIO_EMAIL` / `WIKIFOLIO_PASSWORD` | Wikifolio-Import |
| ☐ | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_NUMBER` | WhatsApp-Alerts |
| ☐ | `NEWSAPI_KEY` | Newsroom |
| ☐ | `ENFORCE_PAYWALL` / `ML_TRAIN_YEARS` / `RUN_NETWORK_TESTS` | Verhaltens-Flags |

> Nicht mehr nötig (Manus-spezifisch): den ursprünglichen `forge.manus.im`-Wert
> **nicht** übernehmen. `FINNHUB_WEBHOOK_SECRET` wird vom aktuellen Code nicht
> gelesen — nur setzen, falls ein Webhook aktiv genutzt wird.
>
> Nach dem Setzen: Railway neu deployen, dann `pnpm db:push` (falls frische DB)
> und die Live-URL gegenprüfen (Login, ein KI-Vorschlag, eine Kursseite).
