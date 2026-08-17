# R1-Rohdiagnose — KGV-Duplikate: Vendor oder App?

**Status:** Read-only-Beweisaufnahme, keine Code-, Daten- oder Screeneränderung.  
**Abrufzeit:** 17. August 2026, 19:19:18–19:20:04 UTC.  
**Abrufmethode:** Direkte EODHD-Fundamentals-Endpunkte mit produktivem Schlüssel und den vom Auftrag vorgegebenen EODHD-Symbolen.

## Ergebnis

| Gruppe | Symbol | `Highlights.PERatio` roh | `Valuation.ForwardPE` roh | Identisch mit Partner (4 Dez.)? |
|---|---|---:|---:|---|
| GSK / FIE | GSK.LSE | 15.4025 | **19.7628** | ForwardPE: **ja** |
| GSK / FIE | FIE.XETRA | 16.6803 | **19.7628** | ForwardPE: **ja** |
| EZJ / SYK | EZJ.LSE | 12.4259 | **22.5225** | ForwardPE: **ja** |
| EZJ / SYK | SYK.US | 35.2243 | **22.5225** | ForwardPE: **ja** |
| RNO / COV / VCT | RNO.PA | 8.7554 | **10.4493** | ForwardPE: **ja** (mit COV) |
| RNO / COV / VCT | COV.PA | 8.9031 | **10.4493** | ForwardPE: **ja** (mit RNO) |

> **Fazit: Vendor.** Die bit-identischen KGV-Werte stammen direkt aus den unveränderten EODHD-Rohantworten: `Valuation.ForwardPE` ist in allen drei geprüften Partnerpaaren bis auf vier Dezimalstellen gleich. Die App erzeugt diese Werte nicht.

`Highlights.PERatio` ist dagegen bei allen geprüften Partnern verschieden. Damit ist zugleich belegt, dass die Duplikation ausschliesslich das von EODHD gelieferte Forward-PE-Feld betrifft, nicht eine globale App-Rundung oder Cache-Kollision.

## JSON-Belege

### GSK.LSE — 2026-08-17T19:19:18.492Z

```json
{
  "Highlights": {
    "PERatio": 15.4025,
    "EarningsShare": 1.18,
    "MarketCapitalization": 72801984512
  },
  "Valuation": { "ForwardPE": 19.7628 }
}
```

### FIE.XETRA — 2026-08-17T19:19:33.897Z

```json
{
  "Highlights": {
    "PERatio": 16.6803,
    "EarningsShare": 2.44,
    "MarketCapitalization": 3417109760
  },
  "Valuation": { "ForwardPE": 19.7628 }
}
```

### EZJ.LSE — 2026-08-17T19:19:41.477Z

```json
{
  "Highlights": {
    "PERatio": 12.4259,
    "EarningsShare": 0.54,
    "MarketCapitalization": 5015901184
  },
  "Valuation": { "ForwardPE": 22.5225 }
}
```

### SYK.US — 2026-08-17T19:19:59.438Z

```json
{
  "Highlights": {
    "PERatio": 35.2243,
    "EarningsShare": 9.63,
    "MarketCapitalization": 130111815680
  },
  "Valuation": { "ForwardPE": 22.5225 }
}
```

### RNO.PA — 2026-08-17T19:20:02.454Z

```json
{
  "Highlights": {
    "PERatio": 8.7554,
    "EarningsShare": 3.27,
    "MarketCapitalization": 8284760576
  },
  "Valuation": { "ForwardPE": 10.4493 }
}
```

### COV.PA — 2026-08-17T19:20:04.141Z

```json
{
  "Highlights": {
    "PERatio": 8.9031,
    "EarningsShare": 5.88,
    "MarketCapitalization": 5795119104
  },
  "Valuation": { "ForwardPE": 10.4493 }
}
```

## Konsequenz

Die bereits vorbereitete Umstellung ist fachlich begründet: Für den Screener sollten selbst aus konsistenten Preis-/EPS- und Wachstumseingaben hergeleitete KGVs verwendet werden. `Valuation.ForwardPE` von EODHD ist höchstens als Gegenprobe beziehungsweise als qualitätsmarkierter Vendorwert zu behandeln. Eine Ursachenanalyse des App-Cache-, Store- oder Exportpfads ist für diese Duplikate nicht erforderlich.

**Hinweis zur dritten Gruppe:** Der Auftrag verlangte Abrufe von RNO.PA und COV.PA, nicht von VCT.PA. Beide angeforderten Partner liefern denselben Rohwert 10.4493. Für den vollständigen Dreiernachweis wäre ein zusätzlicher, ebenfalls read-only Abruf von VCT.PA nötig.

## Referenz

[1]: https://eodhd.com/api/fundamentals/ — EODHD Fundamentals API, abgefragt mit den im Auftrag genannten Symbolen und `fmt=json`.
