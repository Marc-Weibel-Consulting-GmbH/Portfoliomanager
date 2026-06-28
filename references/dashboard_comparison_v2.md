# Dashboard Live vs Mockup - Vergleich v2

## Was STIMMT:
1. ✅ Header: "Guten Tag, Marc" mit Datum (SONNTAG, 28. JUNI 2026)
2. ✅ TickerBar: SMI 14'173 -0.42%, S&P 500 7'354 -0.05%, MSCI WORLD 197 -0.97%, GOLD 374 +1.13%
3. ✅ Quick Actions: 7 Buttons horizontal (Portfolio erstellen, Meine Portfolios, Aktienempfehlungen, Aktiensuche, Portfolio optimieren, Copilot fragen, Preisalarm setzen)
4. ✅ PortfolioCompact: CHF 1'267'291 mit 4 Portfolios + Positionen-Anzahl
5. ✅ MarktPuls: Sektor-Heatmap + Top-Gewinner/Verlierer
6. ✅ KI-Analyse: 5 Sektoren mit 4-5 Sätzen + 3 Aktien + KAUFEN/ABWARTEN Badge
7. ✅ Szenarien nebeneinander: Defensive Konsolidierung 45%, Tech-Rebound 30%, Ausweitung 25%
8. ✅ Anstehende Termine: ISM Services, FOMC Minutes etc. mit Uhrzeit + HOCH/MITTEL Badge

## Was NICHT STIMMT (noch zu fixen):
1. ❌ Portfolio-Namen zeigen "0" (Score) - sollte nicht angezeigt werden wenn 0
   → Fix: nur anzeigen wenn > 0 (schon gefixt im Code, aber noch "0" sichtbar)
2. ❌ Tagesperformance: "CHF 123'900 Fr · -8.9% · YTD -9.3%" 
   → Im Mockup: "CHF 1'834 heute · +0.4% · YTD +11.4%"
   → Problem: Am Wochenende zeigt es "Fr" statt "heute" - KORREKT
   → Aber -8.9% scheint unrealistisch hoch für einen Tag
3. ❌ MarktPuls: Alle Sektoren +0.0% (Wochenende - kein Handel) - das ist KORREKT am Wochenende
4. ❌ Portfolios zeigen "0" neben dem Namen - muss entfernt werden

## Mockup-Details die noch fehlen:
- Im Mockup: Sparkline-Charts in der TickerBar (kleine Linien-Charts)
- Im Mockup: BTC als 6. Index in der TickerBar
- Im Mockup: SOX als 4. Index in der TickerBar (statt MSCI WORLD)
- Im Mockup: Portfolios haben Typ-Label (z.B. "Dividenden · 12 Pos.")
