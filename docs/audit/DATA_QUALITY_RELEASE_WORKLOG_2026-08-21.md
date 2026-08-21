# Datenqualitäts-Release — Arbeitsprotokoll

**Start:** 21. August 2026  
**Ziel:** EU-/SIX-Bewertungskennzahlen belastbar machen, ISIN als ergänzende Emittentenidentität verwenden und Datenqualitätsgründe im Produkt sichtbar machen.

## Phase 1 — bestätigte Ursachen und Ausgangslage

1. Die direkte EODHD-Untersuchung belegt leere oder fehlerhafte `Highlights`-/`Valuation`-Blöcke bei europäischen, besonders SIX-notierten Titeln. Schweizer Titel können Quartalshistorie besitzen, obwohl Vendor-PE, Vendor-PEG und EPS leer bleiben. Die historische Analyse grenzt diese Schwäche klar von der robusteren US-Abdeckung ab.

2. Der Produktionspfad berechnet ein datumsgefenstertes KGV bereits selbst aus Marktkapitalisierung und TTM-Nettogewinn. `kgvFuerBewertung` nutzt diese Selbstrechnung als Primärwert und den Vendorwert als Gegenprobe. Das bereinigte PEG priorisiert hingegen weiterhin `Highlights.PEGRatio`; sein Selbstrechnungsrückfall verwendet noch `trailingPE`/`forwardPE` aus dem Vendor. Damit bleibt gerade der PEG-Pfad bei den identifizierten EU-/SIX-Datenlücken und -Konflikten inkonsistent.

3. Im fertigen Lauf `180001` tragen 805 von 844 berechneten Kandidaten eine ISIN; drei ISIN-Gruppen zeigen sichtbare Mehrfachnotierungen. Beispiele sind Alcon (`2U3.DE`, `ALC.SW`), AstraZeneca (`AZN`, `AZN.L`) und Coca-Cola Europacific Partners (`CCEP`, `CCEP.L`). Die ISIN wird aktuell gespeichert, aber noch nicht als unmittelbarer Deduplizierungsschlüssel verwendet.

4. Die `stocks`-Tabelle persistiert Kennzahlen, enthält aber keine dauerhaften ISIN-, Primärticker- oder Datenqualitätsfelder. Der Admin-API-Vertrag berechnet eine Datenampel nur aus Kurshistorie, Kennzahlenfrische und Scoreabdeckung. Die detaillierteren Screener-Prüfgründe sind bisher allein im Excel-Export sichtbar.

5. Die sichere Deduplizierungsregel muss pro identischer, vorhandener ISIN genau eine Hauptnotiz bewahren. Sie darf Einträge mit fehlender ISIN nicht zusammenführen und darf unterschiedliche Anteilsklassen nicht über Namensähnlichkeit löschen. Der aktuelle Bestand zeigt, dass Anbieter-Primärticker nicht immer für jede Kreuznotierung geliefert werden; ISIN ergänzt ihn daher, ersetzt ihn nicht.

## Phase 3/4 — Umsetzung und Live-Nachweis

6. Die neue Migration `0049_shocking_marvex` ergänzt `stocks` ausschliesslich um nullable Felder für ISIN, Primärticker, Datenqualitätsstatus, Datenqualitätsgründe und Aktualisierungszeit. Die fünf Spalten wurden nach Schemaabgleich additiv angewandt und direkt verifiziert. Die zwei vorhandenen Screener-Übernahmen des Laufs 180001 wurden nicht-destruktiv aus ihren ursprünglichen Kandidatendaten nachgefüllt: BRKN.SW und NFLX tragen jeweils ISIN, Primärticker und Status `geprueft`.

7. Die Admin-Universumsansicht rendert die vorhandene Datenampel jetzt auch mit Screener-Evidenz: `Datenlücke` rot, `Prüfung nötig` gelb, bestehende Kurs-/Score-Frische unverändert grün/orange/gelb. Die Live-Nachprüfung unter dem isolierten QA-Konto bestätigt den Adminzugriff, die gefüllte Tabelle und die sichtbare neue Spalte `Daten`. Die temporär angehobene QA-Adminrolle wird nach Abschluss der Liveprüfung wieder zurückgesetzt.

8. Die Suche nach der backgefüllten Screener-Übernahme NFLX liefert genau eine Zeile mit sichtbar gerenderter Datenampel und Screener-Herkunft. Der sichtbare Punkt ist gelb; vor einer Erfolgsmeldung wird noch abgegrenzt, ob dies die erwartete allgemeine Score-/Kursbasis oder irrtümlich der neue `geprueft`-Status ist.

9. Der DOM-Nachweis erklärt den gelben NFLX-Punkt korrekt mit einer unabhängigen Markt-/Modelllücke: nur fünf Kurstage statt etwa 250 und kein Timing-Score. Der Screenerstatus selbst ist `geprueft`. Damit ein gelber Gesamtpunkt die bestätigte ISIN-/Bewertungsbasis nicht verdeckt, ergänzt der Tooltip jetzt zusätzlich den positiven Hinweis „Screener: ISIN/Primärticker und Bewertungsbasis geprüft“. Die ursprüngliche Implementierung legte den dynamischen Import jedoch fälschlich in einen synchronen `map`-Callback; der Transformfehler wurde nach Ursachenanalyse durch Verlagerung in den umgebenden asynchronen Querypfad behoben. TypeScript und die 38 fokussierten Regressionen bestehen danach.

10. Der abschliessende Browser-/DOM-Nachweis für NFLX bestätigt den zusammengesetzten, verständlichen Tooltip vollständig: „lückenhaft: Kursreihe nur 5 Tage … · kein Timing-Score berechnet · Screener: ISIN/Primärticker und Bewertungsbasis geprüft“. Die Ampel verschleiert damit weder die unabhängig fehlende Kurshistorie noch die positiv geprüfte Screeneridentität.

## Phase 5 — Stichprobe und Freigabegrenze

11. Die reale Kandidatenstichprobe des Laufs 180001 bestätigt die fachliche Abgrenzung: BRKN.SW (Selbst-KGV 23.3935, Trailing-KGV 23.2872) und RNO.PA (8.5665 bzw. 8.6820) besitzen nachvollziehbare TTM-Selbstrechnungen, während der bekannte RNO-Forward-Wert 10.4493 weiterhin von der Selbstrechnung abweicht. Unvollständige Zeilen für ALV.DE, NESN.SW, NOVN.SW und RO.SW bleiben transparent ohne KGV-/PEG-Wert; sie werden nicht durch eine Ersatzannahme übermalt.

12. `FEATURE_EU_SELF_CALCULATED_PEG` ist implementiert und durch Regression gedeckt, aber ohne explizite Umgebungsfreigabe weiterhin `false`. Damit verändert das Release keine produktive PEG-Scoreberechnung vor der vorgeschriebenen OOS-/Walk-Forward-Validierung. Der neue Schattenpfad rechnet im Test gezielt aus Selbst-KGV und Wachstum beziehungsweise blendet PEG ohne tragfähige Basis aus.

13. Nach der Liveprüfung wurde das isolierte QA-Visual-Audit-Konto per Datenbanknachweis wieder auf die Rolle `user` zurückgestuft.
