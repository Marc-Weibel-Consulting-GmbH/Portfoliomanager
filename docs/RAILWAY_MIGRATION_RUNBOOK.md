# Railway-Migration — Runbook (Schritt für Schritt)

Konkrete, abhakbare Anleitung, um den **Portfoliomanager komplett von Manus auf
Railway** zu bringen — inkl. MySQL, Redis, Env, Daten-Umzug und **DNS-Umstellung
für `www.portfolio.mw`**.

> Ergänzt `docs/MIGRATION_MANUS.md` (dort steht die vollständige, kategorisierte
> Secrets-Liste zum Abhaken). Dieses Dokument ist die **operative Reihenfolge**.
>
> Zielarchitektur: **1 Railway-Projekt** mit drei Services im selben privaten
> Netzwerk: **App** (dieses Repo) + **MySQL** + **Redis**. DB-Wahl steht fest:
> **MySQL** (kein Code-Umbau).

Legende: ☐ = offen, `»` = Klickpfad im Railway-Dashboard.

---

## Phase 0 — Vorbereitung (1–2 Tage vor Cutover)

- ☐ **0.1 TTL senken.** Beim DNS-Anbieter von `portfolio.mw` die TTL des
  `www`-Records (und des Apex) auf **300 s** senken. Mindestens 24 h vor dem
  Umzug, damit der spätere Wechsel schnell greift.
- ☐ **0.2 Secrets sammeln.** Alle bei Manus hinterlegten Keys exportieren/notieren.
  Vollliste + Kategorien: `docs/MIGRATION_MANUS.md`, Abschnitt 3.
- ☐ **0.3 `SECRETS_ENCRYPTION_KEY` sichern.** Falls die **bestehende DB
  übernommen** wird (Daten-Umzug), muss dieser Key auf Railway **identisch** zu
  Manus sein — sonst sind die in der DB verschlüsselten API-Keys (Admin ›
  API-Keys) nicht mehr entschlüsselbar. Bei komplett frischer DB egal.
- ☐ **0.4 Daten-Export ziehen** (siehe Phase 3 für die zwei Wege). Vorab testen,
  ob die Manus-MySQL von aussen erreichbar ist.
- ☐ **0.5 LLM-Ziel festlegen.** `BUILT_IN_FORGE_*` darf **nicht** mehr auf
  `forge.manus.im` zeigen (siehe `MIGRATION_MANUS.md` Abschnitt 1). Anbieter +
  Key + Modell bereitlegen (Groq/OmniRoute/OpenAI).

---

## Phase 1 — Railway-Projekt & Services anlegen

- ☐ **1.1 Projekt.** railway.com → `» New Project` → `Deploy from GitHub repo` →
  `marc-weibel-consulting-gmbh/portfoliomanager`, Branch **`main`**.
  - Railway erkennt `railway.json` (im Repo-Root): Build `pnpm build`,
    Start `pnpm start`, Healthcheck `/`, 1 Replica. Node-Version kommt aus `.nvmrc` (22).
- ☐ **1.2 MySQL.** `» New` → `Database` → `Add MySQL`. Läuft im selben Projekt.
- ☐ **1.3 Redis.** `» New` → `Database` → `Add Redis`.
- ☐ **1.4 Referenz-Variablen setzen** (App-Service → `Variables`):
  - `DATABASE_URL = ${{MySQL.MYSQL_URL}}`
  - `REDIS_URL = ${{Redis.REDIS_URL}}`
  - `UPSTASH_REDIS_REST_URL` / `_TOKEN` **leer lassen** → Code nimmt automatisch
    den TCP-Weg (ioredis) statt Upstash.
  - `NODE_ENV = production`
  - `PORT` **nicht** setzen — Railway injiziert den Port, der Server liest ihn.

---

## Phase 2 — Env-Variablen (App-Service)

Alle Werte als **Railway-Variablen** setzen (`getSecret()` liest zuerst
`process.env`, dann DB — Env deckt also alles ab). Checkliste vollständig in
`docs/MIGRATION_MANUS.md` Abschnitt 3. Kern:

- ☐ **A. Kritisch:** `DATABASE_URL` (Ref), `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`,
  `EODHD_API_KEY`.
- ☐ **B. LLM:** `BUILT_IN_FORGE_API_URL/_API_KEY/_MODEL` (+ optional `_MAX_TOKENS`),
  `KIMI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, ggf. `OMNIROUTE_*`.
- ☐ **C. Infra:** `REDIS_URL` (Ref).
- ☐ **D. Frontend `VITE_*`:** ⚠️ **Build-Zeit!** Diese müssen **vor dem ersten
  Build** gesetzt sein, sonst fehlen sie im Client-Bundle. `VITE_APP_URL`
  = `https://www.portfolio.mw`, `VITE_APP_TITLE`, `VITE_APP_ID`,
  `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_WHATSAPP_NUMBER`.
- ☐ **E. Zahlung/Mail:** `STRIPE_SECRET_KEY`/`_WEBHOOK_SECRET`, `RESEND_API_KEY`/
  `EMAIL_FROM` (oder SMTP-Block), `OWNER_OPEN_ID`/`OWNER_NAME`.
- ☐ **F. Optional je Feature:** `FINNHUB_API_KEY`, `TWILIO_*`, `WIKIFOLIO_*`, …

> Nach dem Setzen der `VITE_*` einen **Redeploy** auslösen, damit der Client-Build
> die Werte einbackt.

---

## Phase 3 — Datenbank migrieren (MySQL → MySQL)

**Schema zuerst**, dann Daten.

- ☐ **3.1 Schema anlegen.** Einmalig gegen die Railway-MySQL:
  `DATABASE_URL="<Railway-MySQL-URL>" pnpm db:push`
  (lokal mit der öffentlichen Railway-URL, oder via `railway run pnpm db:push`).

**Daten — Weg A (Manus-MySQL von aussen erreichbar):**
- ☐ **3.2a Dump ziehen:**
  `mysqldump --single-transaction --no-tablespaces -h <manus-host> -u <user> -p <db> > pm_dump.sql`
- ☐ **3.3a Einspielen:**
  `mysql -h <railway-host> -u <user> -p <db> < pm_dump.sql`

**Daten — Weg B (Manus-MySQL nicht erreichbar) — via Repo-Skripte:**
- ☐ **3.2b Export** (auf Manus, wo die alte DB erreichbar ist):
  `pnpm export-data` → schreibt nach `exports/`.
- ☐ **3.3b Import** (gegen Railway-DB): `DATABASE_URL="<Railway-URL>" pnpm import-data`.

- ☐ **3.4 Verifizieren.** Zeilenzahlen der Kern-Tabellen vergleichen
  (`users`, `stocks`, `saved_portfolios`, `portfolio_transactions`,
  `historical_prices`, `app_secrets`). Mit Weg B ist `SECRETS_ENCRYPTION_KEY`
  identisch zu halten (Phase 0.3), sonst DB-Secrets neu über Admin › API-Keys
  eintragen.

---

## Phase 4 — Erst-Deploy & Smoke-Test (noch ohne DNS)

- ☐ **4.1 Public-URL aktivieren.** App-Service → `Settings` → `Networking` →
  `Generate Domain` → `…​.up.railway.app`.
- ☐ **4.2 Build-Log prüfen.** `pnpm install` → `pnpm build` (Vite + esbuild) grün.
  Gotcha: die vendorte `wikifolio`-Abhängigkeit (`vendor/wikifolio`) muss im Repo
  liegen — der Build kopiert sie nach `dist/node_modules/`.
- ☐ **4.3 Smoke-Test auf der Railway-URL** (nicht portfolio.mw):
  Login, ein KI-Portfolio-Vorschlag (Titel-Texte da?), eine Kursseite, keine
  Konsolenfehler. LLM-Antworten kommen (Basis-LLM nicht mehr Manus).
- ☐ **4.4 Cron-Check.** Nur **1 Replica** (in `railway.json` gesetzt) — die
  `node-cron`-Jobs laufen im Prozess; mehrere Replicas würden sie mehrfach
  ausführen. Beim späteren Skalieren Crons in eigenen Worker auslagern.

---

## Phase 5 — DNS umstellen (`www.portfolio.mw`)

- ☐ **5.1 Custom Domain in Railway.** App-Service → `Settings` → `Networking` →
  `Custom Domain` → `www.portfolio.mw` eingeben. Railway zeigt ein **CNAME-Ziel**
  (`<hash>.up.railway.app`).
- ☐ **5.2 DNS-Record setzen** (beim Anbieter von `portfolio.mw`):
  - `www` → **CNAME** → `<hash>.up.railway.app` (TTL 300).
- ☐ **5.3 Apex `portfolio.mw`** (falls die nackte Domain auch zeigen soll):
  - CNAME am Apex ist meist verboten → **ALIAS/ANAME** auf das Railway-Ziel, falls
    der Anbieter das unterstützt (Cloudflare: „CNAME-Flattening"); **oder**
    einfacher: Apex per Anbieter-**Redirect auf `https://www.portfolio.mw`**.
  - Empfehlung: **`www` als kanonische Domain**, Apex leitet dorthin.
- ☐ **5.4 TLS.** Railway stellt automatisch ein Let's-Encrypt-Zertifikat aus,
  sobald der DNS-Record aufgelöst wird (kann einige Minuten dauern; Status im
  Networking-Panel „Issued").
- ☐ **5.5 Propagation prüfen:**
  `dig www.portfolio.mw CNAME +short` → Railway-Ziel;
  danach `https://www.portfolio.mw` im Browser (Schloss-Symbol grün).

---

## Phase 6 — Go-Live-Verifikation (auf `www.portfolio.mw`)

- ☐ **6.1** Login + Session (Cookie auf `www.portfolio.mw` gesetzt, `VITE_APP_URL`
  passt).
- ☐ **6.2** Ein KI-Portfolio-Vorschlag end-to-end (Titel-Texte individuell,
  Challenger/Synthese, kein Manus-Fallback-Fehler).
- ☐ **6.3** Kurse/Fundamentaldaten laden (EODHD).
- ☐ **6.4** Stripe-Webhook: im Stripe-Dashboard die Endpoint-URL auf
  `https://www.portfolio.mw/api/webhooks/stripe` umstellen, Test-Event senden.
- ☐ **6.5** E-Mail-Versand (Passwort-Reset o. Ä.) kommt an.
- ☐ **6.6** Keine Konsolen-/Server-Fehler (Railway → `Deployments` → `Logs`).

---

## Phase 7 — Manus abschalten & Rollback

- ☐ **7.1 Beobachten (24–48 h).** Railway-Logs, keine Fehlerspitzen.
- ☐ **7.2 Auto-Deploy von Manus** ist damit obsolet — der Dev-/Hosting-Server von
  Manus wird nicht mehr gebraucht. Erst **nach** stabiler Beobachtung deaktivieren.
- ☐ **7.3 Rollback-Plan:** DNS-TTL steht auf 300 s → im Ernstfall den `www`-CNAME
  zurück auf das alte Manus-Ziel zeigen. Deshalb Manus-Umgebung erst nach der
  Beobachtungsphase endgültig stilllegen.

---

## Anhang — Stolpersteine (kurz)

| Thema | Achtung |
|---|---|
| `VITE_*` | Build-Zeit-Variablen — vor dem Build setzen, sonst nicht im Client-Bundle. |
| Crons | `node-cron` läuft im Prozess → **1 Replica** halten (in `railway.json`). |
| `SECRETS_ENCRYPTION_KEY` | Bei DB-Übernahme **identisch** zu Manus, sonst DB-Secrets unlesbar. |
| `PORT` | Nicht selbst setzen — Railway injiziert; Server liest `process.env.PORT`. |
| Port-Hop | `findAvailablePort` weicht bei belegtem Port aus; auf frischem Container unkritisch. Falls Healthcheck scheitert → Logs prüfen. |
| `wikifolio` | Vendor-Dep (`vendor/wikifolio`) muss committed sein; Build kopiert sie. |
| Basis-LLM | `BUILT_IN_FORGE_API_URL` **nie** auf `forge.manus.im` — sonst „KI-Text funktioniert nicht". |
