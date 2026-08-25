# Selma-Onboarding-Benchmark und UX-Optimierungsplan

**Datum:** 25. August 2026  
**Benchmark:** Selma Finance, Schweiz  
**Ziel:** Den Einstieg in den Portfoliomanager in einen klaren, vertrauenswürdigen und schrittweise geführten Customer Journey überführen – ohne Produktlogik, Risikohinweise oder Fachdetails vor der ersten Wertwahrnehmung zu überladen.

## 1. Umfang und belastbare Grenze der Analyse

Die Analyse deckt die öffentliche Selma-Startseite, die zielgerichtete Anlage-Unterseite, die Gebührenstrecke, die Sign-up-Seite sowie den authentifizierten Web-Handoff ab. Der vorhandene Login führte nach erfolgreicher Anmeldung ausdrücklich zur mobilen App; ein browserbasierter Eignungs-, Planungs- oder Kontoeröffnungsflow stand damit nicht zur Verfügung. Es wurden **keine** Identitäts-, Steuer-, Zahlungs- oder Vertragsdaten eingegeben und keine Konto- oder Anlagehandlung ausgelöst.[1] [4]

> **Wesentliche Grenze:** Die Vorschläge leiten sich aus beobachtbaren Journey- und Interaktionsmustern ab. Sie kopieren weder Selmas geschützte Gestaltung noch unterstellen sie unzugängliche In-App-Abläufe.

Die acht erfassten Bildschirmansichten und die einzelnen Beobachtungen sind im [Arbeitsprotokoll](./SELMA_ONBOARDING_BENCHMARK_WORKLOG_2026-08-25.md) dokumentiert.

## 2. Was Selma im Einstieg gut macht

Selma führt zuerst über eine **einfache Absicht** und nicht über Anlageinstrumente. Die Startseite verbindet ein einzelnes Nutzenversprechen mit einem einzigen Start-CTA und beweist Glaubwürdigkeit sofort mit externen Mediennennungen, Bewertungen und Kundenzahl. Anschliessend segmentiert sie die Nutzerin oder den Nutzer nach drei Lebenssituationen: Vermögen aufbauen, bestehendes Vermögen verwalten oder Vorsorgekapital anlegen.[1]

Auf der Unterseite „Vermögen aufbauen“ bleibt die Botschaft konsistent: ein individueller Plan, ein sichtbarer Mindestbetrag und ein wiederholter, vierstufiger Ablauf. Die Gebührenstrecke übersetzt Gebühren vor dem Tarifstudium direkt in monatliche und jährliche Frankenbeträge.[2] [3] Der Web-Login macht den Kanalwechsel zur App explizit statt den Nutzer in einer leeren oder irreführenden Browseransicht zurückzulassen.[4]

| Beobachtetes Muster | Wirkung auf die Entscheidung | Übertragung auf den Portfoliomanager |
|---|---|---|
| Eine Absicht vor jeder Detailfrage | Nutzer ordnen sich zuerst selbst ein, statt ein Finanzprodukt zu verstehen | Einstieg über „Was möchten Sie heute erreichen?“ statt „Portfolio anlegen“ |
| Sichtbarer Ablauf vor Commitments | Erwartungsangst sinkt; Dauer und nächste Schritte sind klar | Feste Journey-Leiste: **Profil → Vorschlag → Prüfen → Starten** |
| Vertrauenssignale in der richtigen Reihenfolge | Belege folgen unmittelbar dem Nutzenversprechen | Transparente Datenquellen, reale Datenaktualisierung und erklärbare Modellgrenzen vor der KI-Analyse |
| Frankenbeträge vor Prozentwerten | Kosten und Konsequenzen werden konkret | Angezeigte Einmal-/laufende Kosten und Mindestanlage als CHF-Werte beim ersten Vorschlag |
| Progressive Offenlegung | Fachdetails überfordern nicht vor der Entscheidung | Optimierung, Scores, Backtests, Regelwerke und technische Charts standardmässig eingeklappt |
| Klarer Kanalwechsel | Keine Sackgasse im falschen Endgerät | Wo eine Funktion nur im Browser bzw. mobil sinnvoll ist, klarer Übergabehinweis statt toter Link |

## 3. Hauptdifferenz zum aktuellen Portfoliomanager

Der vorhandene Onboarding-Wizard fragt bereits Ziel, Risiko und Zeithorizont ab. Er beginnt jedoch mit einer Featureliste und enthält im letzten Frageblock ein Premium-Angebot, bevor die Nutzerin oder der Nutzer einen ersten Plan gesehen hat. Danach folgen zwei gleichwertige Startwege und schliesslich ein umfangreicher Portfolio-Builder mit drei Pfaden, fünf KI-Schritten, Sektorausschlüssen, Kapital, Vorschlag, Positionseditor und technischen Details.[5] [6]

Das ist funktional umfassend, aber für Neueinsteiger zu früh zu **produkt- und funktionsorientiert**. Der Kern der Verbesserung ist daher nicht „mehr KI“ oder „mehr Erklärung“, sondern eine deutlichere Reihenfolge: **Absicht → Vertrauen → geringes Commitment → verständlicher Plan → erst dann Kontrolle und Tiefe**.

## 4. Zielbild: ein dreistufiger Customer Journey

### Stufe A – Orientierung in unter 60 Sekunden

Die neue Startstrecke soll nicht mit einem Konto, einem Depotimport oder einer Portfoliokonfiguration beginnen. Sie startet mit einer einzigen Frage:

> **„Was möchten Sie mit Ihrem Vermögen heute tun?“**

| Wahl | Beschriebener nächster Nutzen | Führt zu |
|---|---|---|
| **Mein bestehendes Depot verstehen** | „Wir prüfen Diversifikation, Risiken und mögliche Datenlücken.“ | Import oder manuelle Erfassung |
| **Ein neues Aktienportfolio aufbauen** | „In wenigen Schritten zu einem nachvollziehbaren Vorschlag.“ | KI-Portfolio-Flow |
| **Mein Portfolio laufend begleiten** | „Performance, Signale und Ereignisse im Blick.“ | Dashboard-/Portfolio-Einstieg |

Unterhalb des CTA stehen höchstens drei vertrauensbildende Fakten: Schweizer Währungs- und Datenfokus, transparente Quellen-/Datenqualitätsanzeige und keine automatische Handelsausführung. Preise, Scores, Backtests und Produktfunktionen sind zu diesem Zeitpunkt bewusst nicht sichtbar.

### Stufe B – Persönlicher Plan in vier verständlichen Schritten

Die neue Planstrecke ersetzt nicht die fachliche Engine, sondern bündelt deren Eingaben in vier für Menschen verständliche Entscheidungen.

| Schritt | Nutzerfrage | Gespeicherte Information | Was noch nicht gezeigt wird |
|---|---|---|---|
| 1. Ziel | „Wofür soll dieses Portfolio arbeiten?“ | Wachstum, Ertrag oder ausgewogen | Tickerauswahl, Kennzahlen |
| 2. Spielraum | „Welche Schwankungen passen zu Ihnen?“ | Risikoprofil | Sharpe, CVaR, Optimierungsgrenzen |
| 3. Zeitraum | „Wann soll das Geld verfügbar sein?“ | Anlagehorizont | Historische Backtestgrafiken |
| 4. Anlagestrategie | „Nur Aktien oder breit über Anlageklassen?“ | `allocationScope`, z. B. `stocks_only` | Fehlende Anlageklassenwarnungen, wenn bewusst ausgeschlossen |

Sektorausschlüsse, Liquiditätsreserven, ESG und technische Parameter wechseln hinter einen Link **„Weitere Präferenzen“**. Damit bleibt die erste Entscheidung vollständig, aber der Hauptfluss minimal.

### Stufe C – Vorschlag zuerst, Kontrollebene danach

Nach der KI-Berechnung zeigt die Anwendung zunächst nur einen **Plan-Snapshot**: Ziel, Strategie, Investitionsbetrag, Titelanzahl, Diversifikationsqualität und eine laienverständliche Begründung. Nutzer erhalten drei klare Optionen:

| Handlung | Wirkung | Guardrail |
|---|---|---|
| **Vorschlag ansehen** | Öffnet Plan-Snapshot und drei zentrale Erläuterungen | Keine Transaktion |
| **Details anpassen** | Öffnet Positionen, Sektoren, Gewichtungen und Datenqualität | Kein automatisches Rebalancing |
| **Mit Portfolio starten** | Erstellt Demo- oder Live-Portfolio nach klarer Auswahl | Bestehende KI-Schutzfrist bleibt aktiv |

Erst nach der Portfolioerstellung erscheinen Scores, technische Analyse, komplette Diversifikationsregeln und Volloptimierung als nachgelagerte Werkzeuge. Diese Reihenfolge passt zu den bereits eingeführten Schutzfristen für KI-Portfolios und verhindert, dass ein neuer Vorschlag sofort von einem zweiten Optimierer überschrieben wird.

## 5. Informationsarchitektur für die ersten 30 Tage

| Moment | Standardansicht | Bewusst ausgeblendet | Erfolgskriterium |
|---|---|---|---|
| Erstbesuch | Absicht, drei Vertrauenssignale, Start-CTA | Sidebar, Kennzahlen, Tools | Startquote der Journey |
| Nach Profil | Plan-Snapshot mit Strategie und nachvollziehbarer Begründung | Einzelwerte, Optimierungsfrontier, Backtest | Abschlussrate Profil → Vorschlag |
| Neu erstelltes Portfolio | „Beobachtungsphase“ plus nächste sinnvolle Aktion | Laufende Umschichtungen, technische Alarmierung | Anteil der Nutzer ohne voreilige Änderung |
| Bestehendes Portfolio | Wert, Investiert-vs.-Aktuell, eine wichtigste Aufgabe | Sekundäre Scores und Charts | Wiederkehrende Wochenaktivität |
| Optimierung | Nur echter Handlungsbedarf und Strategiehinweis | Erfüllte Regeln, Detailtabellen, Frontier | Öffnungs-/Übernahmequote mit klarer Entscheidung |

## 6. Priorisierter Umsetzungsplan

### Release 1 – Journey Shell und Messaging (1–2 Wochen)

Der Einstieg wird in eine dreistufige Entscheidungsseite mit Absichts-Karten, Vertrauenszeile und Journey-Leiste überführt. Der bestehende Onboarding-Wizard wird nicht entfernt; er wird hinter der Wahl „Neues Aktienportfolio aufbauen“ als fachlicher Unterflow eingebunden. Die Premium-Kommunikation wandert nach den ersten Plan-Snapshot oder in einen separaten Upgrade-Moment.

**Akzeptanzkriterien:** Ein Nutzer kann ohne Kontodaten in weniger als einer Minute eine Absicht wählen; jeder Schritt erklärt die nächste Konsequenz in einem Satz; der Nutzer sieht maximal einen Primär-CTA pro Bildschirm.

### Release 2 – Plan-Snapshot und Strategievertrag (1–2 Wochen)

Der KI-Builder erhält vor der Positionsdetailansicht eine eigene Ergebnisbrücke. Die Werte `allocationScope`, Ziel, Risiko und Horizont werden visuell als dauerhafter Vertragskopf gezeigt. Für „nur Aktien“ werden keine Multi-Asset-Defizite vorgeschlagen; diese fachliche Regel ist bereits vorhanden und wird jetzt an der Journey-Oberfläche verankert.

**Akzeptanzkriterien:** Jeder Plan nennt Strategie, Anlagebetrag, Titelanzahl, Cash-Reserve und Datenqualitätsstatus. Positionen und technische Details sind nur auf expliziten Wunsch sichtbar.

### Release 3 – Kosten, Vertrauen und Erklärbarkeit (1 Woche)

Vor der Erstellung eines Portfolios wird eine einfache CHF-Auswirkung ergänzt: „Bei CHF X und Y Titeln: erwartete Käufe, geschätzte Mindestpositionsgrösse und Gebührenhinweis.“ Dies ist keine Renditeprognose. Datenquellen, EODHD-/SIX-Hinweise und der Zeitpunkt der letzten Aktualisierung werden als Vertrauenszeile angezeigt.

**Akzeptanzkriterien:** Kosten- und Datenqualitätsinformationen sind vor der Übernahme eines Vorschlags sichtbar; keine fiktiven Rendite- oder Kostenwerte.

### Release 4 – Erst-30-Tage-Begleitung (1–2 Wochen)

Ein neu erstelltes KI-Portfolio erhält eine leichte „Was jetzt?“-Karte: Beobachtungsphase, Zeitpunkt der nächsten sinnvollen Prüfung und zwei sichere Lernaktionen. Rebalancing-Vorschläge bleiben während der Schutzfrist unterdrückt; echte Datenintegritätswarnungen bleiben sichtbar, aber getrennt markiert.

**Akzeptanzkriterien:** Kein normaler Rebalancing-Vorschlag vor Ende der Schutzfrist; Nutzer können trotzdem Datenlücken, fehlende Preise oder Risikowarnungen sehen.

## 7. Messkonzept

Die Umsetzung wird nicht über subjektive „schönere UI“-Urteile bewertet, sondern über Ereignisse im bestehenden Produkttracking.

| Kennzahl | Definition | Zielrichtung |
|---|---|---|
| Journey-Startquote | Besucher mit Wahl einer Absicht / berechtigte Erstbesucher | Steigend |
| Profilabschluss | Vollständige vier Planentscheidungen / Journey-Starter | Steigend |
| Vorschlag-zu-Portfolio | Erstellte Portfolios / gezeigte Plan-Snapshots | Steigend, ohne mehr Abbrüche |
| Frühzeitige Änderungen | Änderungen innerhalb der KI-Schutzfrist / neue KI-Portfolios | Sinkend |
| Detailüberforderung | Öffnen technischer Details vor Plan-Snapshot / Journey-Starter | Sinkend |
| Datenvertrauen | Klick auf Datenqualitäts-/Quellenhinweis und anschliessende Fortsetzung | Qualitativ steigend |

Die Messung erfolgt zunächst als **A/B-fähige, standardmässig deaktivierte Journey-Variante**. Sie verändert weder Optimierungslogik noch Handels- oder Empfehlungspfad. Erst nach einer vordefinierten Beobachtungsperiode wird über eine Aktivierung entschieden.

## 8. Was ausdrücklich nicht übernommen werden sollte

Der Portfoliomanager sollte nicht Selmas App-Only-Handoff kopieren: Das eigene Produkt lebt gerade von der Web-Analyse, Importfähigkeit und tiefen Portfolioeinsicht. Ebenso sollten keine fremden Vergleichssieger-, Kunden- oder Gebührenclaims übernommen werden. Das relevante Lernobjekt ist die **Sequenz** der Entscheidung, nicht die visuelle Kopie oder das Marketingversprechen.

## Referenzen

[1]: [Selma Finance – deutsche Startseite](https://www.selma.com/de-ch)  
[2]: [Selma Finance – Vermögen aufbauen](https://www.selma.com/de-ch/anlegen)  
[3]: [Selma Finance – Gebühren](https://www.selma.com/de-ch/gebuehr)  
[4]: [Selma Finance – Sign-up](https://app.selma.com/de/signup) und authentifizierter Web-Handoff, dokumentiert im Arbeitsprotokoll  
[5]: [Portfoliomanager: OnboardingWizard.tsx](../../client/src/components/OnboardingWizard.tsx)  
[6]: [Portfoliomanager: PortfolioBuilderWizard.tsx](../../client/src/pages/PortfolioBuilderWizard.tsx)
