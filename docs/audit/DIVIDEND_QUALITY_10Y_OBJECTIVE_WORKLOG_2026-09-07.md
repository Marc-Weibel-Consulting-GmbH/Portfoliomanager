# Dividendenportfolio: Sharpe-/Drawdown-Ziel und Zehnjahres-Datengate

**Datum:** 7. September 2026  
**Status:** Methodisch implementiert, standardmässig deaktiviert; kein Portfolio und keine Anlageaktion ausgelöst.

## Zweck

Die bestehende Strategieauswahl wurde um einen bewusst optionalen Modus **«Dividende + Qualität (10 Jahre)»** vorbereitet. Er richtet sich an Anleger, die einen Ertragsfokus mit risikoadjustierter Rendite und begrenztem historischem Verlustprofil verbinden möchten. Der Modus ist keine Rendite- oder Verlustgarantie: Alle Kennzahlen stammen aus historischen Kursdaten und zeigen nur das beobachtete vergangene Verhalten.

> Der Modus erstellt nur einen Vorschlagsentwurf. Ein Portfolio entsteht weiterhin erst nach einer gesonderten, sichtbaren Nutzerübernahme.

## Optimierungsvertrag

| Bestandteil | Festlegung | Begründung und Grenze |
|---|---:|---|
| Aktivierung | `FEATURE_DIVIDEND_QUALITY_10Y=false` | Standardmässig gesperrt; der Client kann den Status nicht selbst einschalten. |
| Zieluniversum | Ausschliesslich Dividendenziel | Wachstum- und Balanced-Vorschläge behalten ihren bisherigen Vertrag. |
| Kursbasis | 2’520 Handelstage / zehn Kalenderjahre | Nur Titel mit einer gespeicherten Beobachtung am oder vor dem exakten 10-Jahres-Stichtag sind zugelassen. |
| Dividendenziel | mindestens 2,5 % | Soft-Constraint, weil eine harte Vorgabe ein unzulässiges oder konzentriertes Ergebnis verursachen kann. |
| Sharpe-Ziel | mindestens 0,5 | Historischer, risikofreier Zins wird aus dem vorhandenen Optimierer übernommen. |
| Drawdown-Ziel | maximal 25 % | Historischer Max-Drawdown als positiver Verlustbetrag; ebenfalls Soft-Constraint, transparent als erfüllt/nicht erfüllt ausweisbar. |
| Standardmodus | unverändert Max-Dividende / fünf Jahre | Rückwärtskompatibel und bei jedem nicht expliziten Auswahlwert aktiv. |

Der neue Drawdown-Penalty verwendet dieselbe vollständig datums-ausgerichtete historische Renditematrix wie die bestehende CVaR-Logik. Es fliessen keine geschätzten Werte und keine späteren Preise in das zum jeweiligen Lauf verfügbare Fenster ein. Die Engine gibt bei aktivem Ziel zusätzlich den beobachteten Max Drawdown sowie Erfüllungsstatus der drei Soft-Constraints zurück.

## Reale Datenabdeckung

Die Abdeckung wurde am 7. September 2026 unmittelbar aus `historical_prices` gegen den Aktienbestand geprüft. Die Datenmenge ist für einzelne Titel ausreichend, aber nicht für die Mehrheit der gegenwärtigen Empfehlungstitel. Das Gate verhindert deshalb bewusst eine scheinbare zehnjährige Vergleichsbasis.

| Kennzahl | Ergebnis |
|---|---:|
| Aktienzeilen im geprüften Universum | 310 |
| Kuratierte Empfehlungstitel | 267 |
| Titel mit nachgewiesener Zehnjahresbasis | 43 |
| Empfehlungstitel mit nachgewiesener Zehnjahresbasis | 41 |
| Empfehlungstitel ohne nachgewiesene Zehnjahresbasis | 226 |

Die Abfrage normalisiert dabei ausschliesslich den bestehenden `.US`-Schlüssel genauso wie der Optimierer. Fehlende oder zu junge Reihen führen zum Ausschluss und zu einem expliziten Datenhinweis; sie werden nicht mit kürzerer Historie, Imputation oder einem Ersatzindex aufgefüllt.

## Bedienung und Freigabegrenze

Im automatischen Wizard wird beim Anlageziel **«Dividenden & Ertrag»** ein zweiter Abschnitt «Gewichtungsziel» angezeigt. Der bisherige Dividendenfokus bleibt vorausgewählt. Die erweiterte Kachel benennt Dividendenschwelle, Sharpe-Ziel, Drawdown-Ziel und die Zehnjahresanforderung. Solange das Feature-Flag nicht aktiv freigegeben ist, ist sie sichtbar als **«In Prüfung»** gesperrt.

Die serverseitige Vorschlagsroute prüft die Freigabe zusätzlich. Selbst ein künstlich erzeugter Client-Request mit `dividend_quality_10y` wird bei deaktiviertem Flag zurückgewiesen. Damit kann die Option weder über die Oberfläche noch über den Netzwerkvertrag unbemerkt aktiviert werden.

## Verifikation

| Prüfung | Ergebnis |
|---|---|
| TDD: Default, explizite Zielkombination, Nicht-Dividenden-Fallback und exakte 10-Jahresgrenze | 4 Tests bestanden |
| TypeScript | `pnpm exec tsc --noEmit` bestanden |
| Vollständige Projektsuite | 185 Testdateien bestanden, 5 bewusst übersprungen; 1’482 Tests bestanden, 11 bewusst übersprungen |
| Live-Wizard | Dividendenziel, Standardauswahl, gesperrte 10-Jahreskachel und Datenhinweis auf Desktop geprüft |
| Portfolio-/Handelswirkung | Keine Vorschlagsrechnung gestartet, kein Portfolio erstellt, keine Watchlist-, Score-, Signal- oder Handelsdaten verändert |

## Vor einer späteren Freigabe

Eine aktive Pilotfreigabe sollte erst erfolgen, wenn die tatsächliche Zehnjahresabdeckung für genügend diversifizierte Titel ausreicht und ein vorregistrierter OOS-Vergleich des Standard-Dividendenmodus gegen den erweiterten Modus vorliegt. Dieser Vergleich muss neben Sharpe und historischer Rendite mindestens Max Drawdown, Turnover, Kosten, Sektor- und Währungskonzentration sowie die Stabilität über unterschiedliche Marktregime ausweisen. Erst nach dokumentierter menschlicher Review darf das Flag einzeln und reversibel freigegeben werden.

## Interne Referenzen

- [`server/lib/dividendQualityObjective.ts`](../../server/lib/dividendQualityObjective.ts)
- [`server/analytics/engine.ts`](../../server/analytics/engine.ts)
- [`server/routers/autoPortfolioJobs.ts`](../../server/routers/autoPortfolioJobs.ts)
- [`server/routers/autoPortfolioRouter.ts`](../../server/routers/autoPortfolioRouter.ts)
- [`client/src/pages/PortfolioBuilderWizard.tsx`](../../client/src/pages/PortfolioBuilderWizard.tsx)
