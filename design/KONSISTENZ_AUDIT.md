# Konsistenz-Audit — Woche vom 24.08.2026

Wöchentliche Prüfung von `main` gegen die Leitsätze L1–L5
(`design/KONSOLIDIERUNG_RECHENWERKE.md`) gemäss CLAUDE.md Abschnitt 6.

**Geprüfter Bereich:** Commits vom 16.08.–24.08.2026,
`235d5d6` (PR #336) bis `2b44e86` — darin die Session-PRs #336–#339
(Risiko-Tab/CSP, LPPL-t1, Timing-Dialog, FASSUNG 8) sowie zehn
«Checkpoint»-Commits, die direkt auf `main` gelandet sind
(Manus-Arbeitsfluss, u. a. visuelles Audit, Datenqualitäts-Release,
Research Desk Lite, Empfehlungslogik, Optimierungs-UX).

## Ergebnis in einem Satz

Die Kernrechenwerke sind unberührt und die neuen Labor-Pfade sauber
gegatet — aber die neue Empfehlungs-Policy führt kundenwirksame Regeln
(7-Tage-Schutzfrist, Unterdrückungs-Regel mit fixer Signal-Schwelle 60)
ohne Heimat in der Strategie-Doku ein.

## Sauber (geprüft, kein Befund)

- **Kernrechnung unangetastet:** `dreiScores.ts`, `punktInZeit*`,
  `signalCacheCron`, `kernsignalUebernahme` wurden von den
  Checkpoint-Commits nicht verändert. Die einzige Rechnungsänderung der
  Woche (KGV-0-Punkte-Anker → 40) lief regelkonform: FASSUNG 7 → 8,
  Änderungslog-Eintrag, Tests (PR #339).
- **Selbst-PEG für EU-/SIX-Titel (L4 ✓):** vollständig implementiert,
  aber hinter `FEATURE_EU_SELF_CALCULATED_PEG` (default **aus**) und mit
  ausdrücklichem OOS-Vorbehalt im Kommentar. Ohne Flag bleibt der
  bisherige PEG-Vertrag exakt erhalten (`bereinigtesPeg.ts` wurde nur im
  Anzeigetext angepasst, nicht in der Rechnung).
- **Research Desk Lite (L3/L4 ✓):** Shadow-Mode mit eigenen additiven
  Tabellen (`research_desk_*`), Maker-Checker-Adminansicht, fail-closed
  Scheduled-Endpoint. Kein Schreibpfad in Scores, Signale oder
  Empfehlungen gefunden; OOS-Gate geschlossen.
- **Keine ungegatete Lernschleife**, keine neue Signalformel, keine
  Kaufrangliste im geprüften Bereich.
- **Migrationen 0048–0051 additiv** (kein DROP/Spaltenabbau).

## Befunde

### B1 (mittel) — Empfehlungs-Policy ohne Heimat in der Strategie-Doku

`server/lib/recommendationPolicy.ts` (neu, wirkt im Copilot-Router auf
kundensichtbare Empfehlungen) führt zwei Regeln ein:

1. **7-Tage-Schutzfrist** für Wizard-/KI-Portfolios
   (`AI_PORTFOLIO_PROTECTION_DAYS = 7`): alle Umschichtungsvorschläge
   werden unterdrückt.
2. **Unterdrückungs-Regel:** Reduzieren/Verkaufen wird in Halten
   umgewandelt, wenn die Signallage «positiv» ist — definiert als
   `signalType === 'buy'` **oder `signalScore ≥ 60`** — und kein
   Risiko-/Datenintegritäts-Override vorliegt.

Beides ist fachlich vertretbar und L5-konform (Signal wirkt als
Türsteher, nicht als Rangliste). Aber: Die Regeln stehen nur in
`docs/audit/RECOMMENDATION_LOGIC_WORKLOG_2026-08-21.md`, nicht in
`design/STRATEGIE_DREI_SCORES.md`. Die **fixe Schwelle 60** ist zudem
eine neue, dritte Interpretationsgrenze des Signal-Scores neben den
Bändern der Signal-Skala und `rules.upgradeScoreThreshold` aus K3 —
genau die Sorte stiller Zweitinterpretation, die K3 gerade abgebaut hat.

**Vorschlag:** Änderungslog-Eintrag in STRATEGIE_DREI_SCORES.md
(«Empfehlungs-Policy: Schutzfrist + Signal-Türsteher»), und die Schwelle
aus derselben Quelle beziehen wie die übrigen Signal-Grenzen (oder dort
als benannte Konstante mit Begründung verankern), statt einer nackten 60
im Policy-Code.

### B2 (klein) — Signallage-Text zeigt «Kauf» als Verlegenheits-Default

`recommendationPolicy.ts`, `signalContext`: Ist `signalScore` vorhanden,
aber `signalType` weder `sell` noch `hold` (z. B. `null`), lautet der
Text «Signallage: Kauf (…/100)». Ein unbekannter Typ sollte neutral
benannt werden, nicht als Kauf.

### B3 (klein, Doku) — OFFEN-Vermerke zum E3-Block überholt

`2b44e86` speichert die Wizard-Wahl «nur Aktien» dauerhaft am Portfolio
und unterdrückt nicht gewählte Anlageklassenregeln — das setzt einen
Teil des in der Konsolidierungs-Vorlage und im K4-Änderungslog als
«OFFEN für den E3-Sprint» markierten Umbaus um (Anlageklassen-Wahl als
Merkmal). Die OFFEN-Vermerke in beiden Dokus müssen nachgeführt werden,
sonst beschreibt die Vorlage einen Stand, den es nicht mehr gibt.

## Beobachtung (kein Befund)

Die zehn Checkpoint-Commits liefen direkt auf `main` (ohne PR). Das ist
der etablierte Manus-Arbeitsfluss und verletzt keinen Leitsatz; der
wöchentliche Audit-Lauf bleibt damit aber die einzige nachgelagerte
Leitsatz-Prüfung für diesen Pfad.
