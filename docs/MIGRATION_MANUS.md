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
