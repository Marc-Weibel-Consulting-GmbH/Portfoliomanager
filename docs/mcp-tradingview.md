# TradingView MCP Server

Dieser MCP-Server bringt Trading-Intelligenz (technische Analyse, Backtesting,
Sentiment, Yahoo-Finance-Daten) als Tools in Claude Code und andere
MCP-Clients. Der Server ist als Git-Vendor unter `mcp-servers/tradingview/`
eingecheckt und wird über `.mcp.json` im Repo-Root registriert.

- Upstream: https://github.com/atilaahmettaner/tradingview-mcp
- Package: `tradingview-mcp-server` (PyPI)
- Lizenz: MIT
- Python: >= 3.10

## Schnellstart

Voraussetzung ist [`uv`](https://github.com/astral-sh/uv) (liefert `uvx`).
Mit der eingecheckten `.mcp.json` startet Claude Code den Server beim
Öffnen des Repos automatisch über `uvx`. Beim ersten Start lädt `uvx` das
PyPI-Paket in einen ephemeren venv-Cache.

```bash
# uv installieren (falls noch nicht vorhanden)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Smoke-Test
uvx --from tradingview-mcp-server tradingview-mcp --help
```

In Claude Code aktivierst du den Server beim ersten Start aus dem Repo per
Prompt zur Bestätigung der `.mcp.json`. Anschliessend stehen die Tools
unter dem Prefix `mcp__tradingview__*` zur Verfügung.

## Alternative Quellen

### Lokaler Vendor (mcp-servers/tradingview/)

Wenn das PyPI-Release zu alt ist oder lokale Patches getestet werden
sollen, kann statt des veröffentlichten Pakets der eingecheckte Quellbaum
ausgeführt werden. Dafür `.mcp.json` umstellen auf:

```json
{
  "mcpServers": {
    "tradingview": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "mcp-servers/tradingview",
        "tradingview-mcp"
      ]
    }
  }
}
```

### Docker

```bash
docker compose -f mcp-servers/tradingview/docker-compose.yml up -d
```

## Tool-Übersicht (Auszug)

Der Server stellt > 30 Tools bereit. Die für den Portfoliomanager
relevantesten:

- **Technische Analyse**
  - `tradingview_analysis` – Buy/Sell-Recommendation + Indikatoren
    (RSI, MACD, MAs) für ein Symbol/Exchange/Interval.
  - `multi_timeframe_analysis` – gleiche Analyse über mehrere
    Timeframes parallel (Trend-Konfluenz).
  - `combined_analysis` – TA + Screener-Snapshot in einem Call.
- **Screening**
  - `crypto_screener`, `stock_screener` – Universe-Filter nach
    Marktkap, Volumen, Performance, Indikatoren.
- **Backtesting** (9 Strategien, May 2026)
  - `backtest_strategy` – Single-Run mit Trade-Log + Equity-Curve.
  - `compare_strategies` – Ranking aller 9 Strategien.
  - `walk_forward_backtest_strategy` – Train/Test-Split mit
    Overfitting-Verdict (ROBUST / MODERATE / WEAK / OVERFITTED).
- **Markt- & Fundamentaldaten**
  - `yahoo_finance_data`, `company_info`, `earnings`.
- **Sentiment & News**
  - `reddit_sentiment`, `financial_news` (Yahoo / MarketWatch / CNBC).

Vollständige Liste & Beispiele: siehe
`mcp-servers/tradingview/README.md` und `mcp-servers/tradingview/EXAMPLES.md`.

## Einsatz im Portfoliomanager

Sinnvolle Use-Cases für dieses Projekt:

1. **Holding-Plausibilisierung** – nach jedem Refresh der Stammdaten ein
   `multi_timeframe_analysis` über die Top-Positionen laufen lassen und
   das Resultat im Stock-Detail anzeigen.
2. **Benchmark-Konfluenz** – `combined_analysis` für SPY / ACWI als
   Markt-Header.
3. **Strategie-Lab** – `walk_forward_backtest_strategy` für die
   Score-Heuristik im `analytics_service` validieren, bevor neue Regeln
   live gehen.
4. **News-Feed** – `financial_news` als Quelle für die Portfolio-
   Übersichtsseite (ersetzt die alten Reuters-RSS-Hooks, die seit
   Mai 2026 tot sind).

## Rate-Limits & Stabilität

Der Server enthält seit Mai 2026 einen Throttle-Layer
(`tradingview_ta`, default 4 parallele Calls, mind. 0.8 s Spacing) sowie
Retry + 60 s TTL-Cache auf dem Screener-Provider. Damit verschwinden die
früheren `"Expecting value"`-Fehler bei parallelen Bursts. Werte sind
über Env-Variablen tunebar (`TV_TA_MAX_CONCURRENCY`,
`TV_TA_MIN_SPACING_SECONDS` – siehe Upstream-README).

## Updates

```bash
# Vendor aktualisieren
rm -rf mcp-servers/tradingview
git clone https://github.com/atilaahmettaner/tradingview-mcp.git mcp-servers/tradingview
rm -rf mcp-servers/tradingview/.git
git add mcp-servers/tradingview
git commit -m "chore(mcp): bump tradingview-mcp vendor"
```

`uvx` zieht beim Start automatisch die neueste PyPI-Version, sofern der
Cache nicht eingefroren ist. Pin auf eine Version geht über:

```json
"args": ["--from", "tradingview-mcp-server==0.7.1", "tradingview-mcp"]
```
