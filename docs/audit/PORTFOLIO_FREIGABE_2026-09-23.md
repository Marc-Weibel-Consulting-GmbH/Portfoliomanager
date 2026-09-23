# Portfoliofreigabe «Mami» – 23. September 2026

## Auftrag und Umsetzung

Auf ausdrücklichen Auftrag des Eigentümers wurde für das Portfolio **«Mami»** (`4020001`) ein personenbezogener, widerrufbarer **Nur-Lesezugriff** angelegt. Der Zugang gilt ausschliesslich für die bestehenden Konten von Nicole Weibel Manser und Jürg Weibel. Er ist keine öffentliche Freigabe und vermittelt keinerlei Schreib-, Handels-, Zahlungs-, Cash-, Transaktions-, Aktivierungs- oder Verwaltungsrechte.

| Empfänger | Berechtigung | Portfolio | Status |
|---|---|---:|---|
| nicole.weibelmanser@bluewin.ch | `view` | 4020001 «Mami» | aktiv |
| juerg.weibel@datazug.ch | `view` | 4020001 «Mami» | aktiv |

Die neue Tabelle `portfolioShares` speichert pro Portfolio und Empfänger die Berechtigung, den Freigebenden und einen optionalen Widerrufszeitpunkt. Der zusammengesetzte Unique-Key verhindert Doppelvergaben. Ein Widerruf ist ohne Datenlöschung möglich, indem `revokedAt` gesetzt wird.

## Sicherheitsmodell

Die bestehende Eigentümerschaft in `savedPortfolios.userId` bleibt unverändert die alleinige Grundlage für jede Mutation. Die neue Hilfsfunktion `getPortfolioReadAccess` gewährt entweder `owner` oder den engen Status `viewer`. Bestehende Mutationspfade verwenden weiterhin ihre bisherigen, strikten Eigentümerprüfungen.

Für Leser sind die Detailansicht und die dazugehörigen **reinen Leseabfragen** verfügbar: Positionen, Wertentwicklung, Performance, Risiko, Dividenden, Transaktionshistorie, realisierte Gewinne, Exporte und Signal-Cache. Die Oberfläche kennzeichnet den Zugriff sichtbar als «Geteilt mit Ihnen · Nur lesen» und blendet Bearbeitung, Einzahlungen, Aktivierung/Deaktivierung, Positionserfassung, Transaktionsimporte/-löschung, Signal-Neuberechnung, Portfolio-Optimierung, KI-Deep-Dive und Qualitäts-Backfill aus.

## Verifikation

Die Tabelle, ihre sieben Spalten, Indizes und der Eintrag je Empfänger wurden über die Projekt-Datenbank geprüft. Ein direkter Datenbankhelfer-Test bestätigte anschliessend:

| Prüffall | Ergebnis |
|---|---|
| Nicole → Portfolio 4020001 | `viewer` |
| Jürg → Portfolio 4020001 | `viewer` |
| Eigentümer → Portfolio 4020001 | `owner` |
| Reine Richtlinienlogik | 3/3 Tests bestanden |
| TypeScript | fehlerfrei |

## Drizzle-Migrationsstatus

Die neue, nicht-destruktive Migration `0052_portfolio_view_shares.sql` wurde erzeugt und inhaltlich geprüft. Der reguläre Aufruf `pnpm exec drizzle-kit migrate` wurde **nicht erzwungen**, weil eine bereits bestehende Migrations-Tracking-Abweichung davor abbrach:

> `ALTER TABLE research_signals ADD githubIssueNumber int;`  
> `Duplicate column name 'githubIssueNumber'`

Die fragliche Spalte existiert bereits; die Datenbankmigration scheitert somit vor `0052`. Um den beauftragten, eng abgegrenzten Zugriff ohne Änderung, Drop oder Reset der Altstruktur sicher bereitzustellen, wurde ausschliesslich die geprüfte `CREATE TABLE portfolioShares`-DDL samt zwei `view`-Einträgen angewandt. Der historische Drizzle-Tracking-Konflikt bleibt bewusst unangetastet und ist separat zu bereinigen, bevor ein späterer vollständiger `drizzle-kit migrate`-Lauf wieder zuverlässig werden kann.

## Nicht erfolgt

Es wurden keine Portfolio-, Positions-, Cash-, Preis-, Watchlist-, Transaktions-, Ledger-, Zahlungs- oder Handelsdaten verändert. Es gab keine automatische Order, keine Aktivierung und keine öffentliche Freigabe.
