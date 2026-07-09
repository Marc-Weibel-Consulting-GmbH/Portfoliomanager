# Konzept: Anlegerprofil 2.0 (geführt, nach Beratungsstandard)

> Freigegeben (Richtung + 5 Empfehlungen bestätigt). Umsetzung in Stufen P1–P4, je eigener PR.
> Visuelles Konzept (Artifact): geführtes Profil mit Fragebogen, Ergebnis-Dashboard und Kopplung
> an Optimizer & Builder.

## Idee

Vom Risiko-Dropdown zu einem geführten Profil, das drei Dimensionen trennt (FIDLEG/MiFID II):

- **Risikofähigkeit** (objektiv): Vermögen, Sparquote, Liquiditätsreserve, Einkommensstabilität, Horizont.
- **Risikobereitschaft** (subjektiv): Szenario-Fragen zur Verlustreaktion.
- **Risikobedarf**: Zielrendite vs. Ziel — nur Abgleich, kein Treiber.

**Bindendes Profil = min(Fähigkeit, Bereitschaft).** Zielkonflikte werden sichtbar gemacht,
nicht stillschweigend übersteuert.

## Bestätigte Entscheidungen

1. Finanzangaben als **grobe Bänder** mit optionaler Präzisierung.
2. **Kenntnisse & Erfahrung** in leichter Variante (steuert Instrumentenwahl).
3. **Musterallokation als Anker** anbieten; Umschichtung bleibt Default.
4. Intern **Score 0–100**, nach aussen die vier vertrauten Stufen.
5. Überprüfung **jährlich + manueller Auslöser**.

## Datenmodell

Bestehendes `user_investment_profile` bleibt die **aktive Profilquelle** (Optimizer/Builder lesen daraus).
Die Bewertung landet additiv in einer **neuen Tabelle** `investor_profile_assessment` (ein Datensatz je
Nutzer): capacityScore/toleranceScore/needScore, bindingProfile, knowledgeLevel, financialSituation (Bänder),
answers (Rohantworten), strategicAllocation, version, completedAt, lastReviewedAt, nextReviewDueAt.
Fehlertolerant: fehlt die Tabelle, funktioniert das einfache Profil weiter.

## Stufen

| Stufe | Inhalt |
|---|---|
| **P1** | Fragebogen-Wizard (5 Schritte) + Scoring (Fähigkeit/Bereitschaft/Bedarf → bindendes Profil); neue Tabelle + Router; schreibt zusätzlich das aktive `user_investment_profile`. |
| **P2** | Ergebnis-Dashboard: Risiko-Tacho, Musterallokation, Klartext, Zielkonflikt-Hinweis. |
| **P3** | Tiefe Optimizer-Kopplung: Zielvola/δ, Caps-Sensitivität, Momentum-vs-Qualität aus dem Profil. |
| **P4** | Überprüfungs-Erinnerung (jährlich + manuell) + Profil-Versionierung. |

## Musterallokationen (Richtwerte, im Admin konfigurierbar)

| Profil | Aktien | Anleihen | Cash | Zielvola |
|---|---|---|---|---|
| Konservativ | 25 % | 55 % | 20 % | ≈ 5 % |
| Ausgewogen | 50 % | 38 % | 12 % | ≈ 9 % |
| Wachstum | 72 % | 20 % | 8 % | ≈ 13 % |
| Aggressiv | 90 % | 5 % | 5 % | ≈ 17 % |

## Wirkung (jede Eingabe hat genau eine Aufgabe)

- Risikoprofil → Optimizer-Methode & Zielvolatilität/δ.
- Horizont → Momentum ↔ Qualität.
- Max. Verlusttoleranz → Härte der Positions-/Sektor-Caps, LPPL-Sensitivität.
- Anlageziel → Dividende ↔ Wachstum.
- Cash-Quote/Liquidität → Mindest-Cash.
- Ausschlüsse/ESG → harte Filter vor der Optimierung.
- Kenntnisse & Erfahrung → zulässige Instrumente im Builder.
