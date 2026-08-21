# Abschlussbericht: Visuelles und funktionales End-to-End-Audit

**Prüfdatum:** 21. August 2026  
**System:** Portfoliomanager, React-/tRPC-/Express-Anwendung  
**Prüfgegenstand:** Nutzer-, Portfolio-, Markt-, Research-, Admin- und Exportflüsse inklusive Fehler-, Daten- und Responsive-Zuständen  
**Prüfmethode:** Browsergestützte End-to-End-Prüfung, datenbankgestützte Zustandsverifikation, Codepfad-Trace, testgetriebene Remediation und vollständige Regression

## Urteil

Das Audit ist **abgeschlossen**. Alle während der Prüfung als produktrelevant bestätigten P0- und P1-Befunde wurden entweder testgetrieben behoben oder durch eine erneute End-to-End-Prüfung als nicht reproduzierbar abgegrenzt. Die abschliessende Suite umfasst **1'431 bestandene Tests** bei **11 bewusst übersprungenen Live-/Integrationsfällen**. Die produktive Version des Zwischenstands ist mit Checkpoint `1e785068` veröffentlicht.[1]

Die Anwendung zeigt in den geprüften Kernflüssen einen funktionalen und nachvollziehbaren Zustand. Verbleibende Einschränkungen betreffen ausschliesslich klar abgegrenzte Drittanbieter- bzw. Datenqualitätsrisiken, insbesondere eine fehlende Preisauflösung für `ROG.SW`, die Qualität europäischer EODHD-Kennzahlen und die Sichtbarkeit externer TradingView-Inhalte in der isolierten Browserumgebung. Diese Punkte wurden nicht als App-Fehler fehlklassifiziert.[2] [3]

> **Release-Bewertung:** Kein offener, reproduzierter P0- oder P1-Anwendungsfehler aus diesem Audit. Die bestehenden Datenqualitäts- und Drittanbietergrenzen bleiben transparent dokumentiert und sollen weiterhin über die bereits angelegten Datenqualitäts- und Vendor-Remediationsarbeiten verfolgt werden.

## Prüfumfang und Sicherheitsrahmen

Das Audit nutzte ein isoliertes QA-Konto und das klar benannte Testportfolio **„Demo Portfolio – Schweizer Blue Chips“** (ID `3570001`). Es wurden weder fremde Portfolios verändert noch E-Mails, WhatsApp-Nachrichten, Zahlungen oder produktive Löschungen ausgelöst. Für die Adminprüfung wurde die Rolle des Testkontos vorübergehend erhöht und am Ende nachweislich auf `user` zurückgesetzt.[2]

| Prüffeld | Geprüfter Umfang | Ergebnis |
|---|---|---|
| Authentifizierung und Onboarding | Registrierung, Onboarding, Beispielportfolio, Rückleitungsvertrag | Funktionsfähig; frühere Rückleitungsbeobachtung im aktuellen Routervertrag nicht reproduzierbar |
| Portfolio-Lebenszyklus | Erstellung, Live-Aktivierung, Positionen, Transaktionen, Kennzahlen, Cash, Optimierung | Funktionsfähig nach den dokumentierten Remediationen |
| Aktien und Detailseiten | Suche nach NOVN, SIX-Priorisierung, Detaildaten, Handels- und Alarmaktionen | Funktionsfähig; TradingView-Iframe extern abgegrenzt |
| Markt und Research | Markt-Hub, Tagesbericht, KI-Analyse, Research-Liste, Vorläufigkeitsfilter | Funktionsfähig; Frische- und Datumsvertrag korrigiert |
| Tools und Einstellungen | Zinseszins-, Dividendenrechner, Gebühren, Preisalarme | Rechenwerte unabhängig bestätigt; Dialog- und Leerzustände korrekt |
| Admin und Export | Rollenprüfung, Watchlist, Diagnosen, Screener-Excel-Export und Review-Queue | Funktionsfähig; Excel-Struktur fachlich verifiziert |
| Responsive und Fehlerzustände | Öffentliche Startseite bei 390 × 844 Pixeln, Lade-/Timeout-/Leerzustände | Kein horizontaler Überlauf, keine mobilen Konsolenfehler; private Sitzung aus Sicherheitsgründen nicht in die unabhängige Browserinstanz übertragen |

## Bestätigte Befunde und Remediationen

Die nachstehende Tabelle trennt Symptome, nachgewiesene Ursache und wirksame Korrektur. Jede Remediation wurde vor der Implementierung mit einem roten Test oder einem reproduzierbaren Datenzustand abgesichert und danach erneut geprüft.[2]

| Priorität | Befund | Nachgewiesene Ursache | Umgesetzte Remediation | Verifikation |
|---|---|---|---|---|
| P0 | Live-Aktivierung zeigte weiterhin Demo-Semantik | `portfolioType` blieb bei `demo`, obwohl `isLive` und `status` gesetzt waren | Aktivierungs-Update setzt `portfolioType='live'` verbindlich | Regression, DB-Nachweis (`isLive=1`, `status=live`, `portfolioType=live`) und sichtbarer LIVE-Badge |
| P0 | Manuelle Käufe/Verkäufe änderten Positionen und Kennzahlen nicht | Detailrouter nutzte Basispositionen, verrechnete spätere Ledger-Deltas nicht und hielt einen Detailcache | Stückzahlversöhnung für nachträgliche Buchungen im echten Detailpfad; Cache-Invalidierung nach Transaktion | NOVN von 12 auf 10 Stück, Wert CHF 1'502 auf CHF 1'252; fokussierte Tests bestanden |
| P0 | Einzahlungen änderten weder Cash noch Einstand | `createPortfolioTransaction` schrieb nur das Ledger; `savedPortfolios.cashBalance` blieb unverändert | Zentrale Cash-/Einstandsdelta-Ableitung und Fortschreibung nach Ledger-Insert | Zweite CHF-1-Testeinzahlung aktualisierte sofort Transaktionen 9→10, Wert CHF 7'938→CHF 7'939 und Einstand CHF 10'000→CHF 10'001 |
| P0 | Copilot konnte endlos laden | Mehrstufige Provider-/Tool-Kaskade ohne globales Zeitbudget | Globales 90-Sekunden-Limit im Chatpfad | Kontrollierter Fehler statt dauerhaftem Spinner; Regressionen bestanden |
| P1 | Copilot-Timeout verschwand aus dem Gespräch | Server warf Fehler nach Nutzernachricht; Client zeigte nur flüchtigen Toast | Fehler wird als Assistentennachricht persistiert und der Verlauf invalidiert | Persistenz- und Cache-Regressionen bestanden |
| P1 | Deep Dive kommunizierte 15–30 Sekunden, konnte aber unbegrenzt laufen | Sequenzielle Daten- und LLM-Aufrufe ohne Gesamttimeout | Globales 90-Sekunden-Budget, konkreter Fehlerzustand und Wiederholungsaktion | Rote/grüne Timeouttests; Live-Ladehinweis bestätigt |
| P0 | Markt-Hub konnte Zukunfts- oder Altinhalte als aktuell darstellen | Getrennte Verträge für Tagesbericht und KI-Tagesanalyse; Analyse zeigte pauschal das heutige Datum | Sichtbarkeits- und 36-Stunden-Frischegrenze, echtes Daten-/Erstellungsdatum | Frischetests bestanden; Markt-Hub zeigt ohne frischen Datensatz erklärten Leerzustand |
| P0 | Empfehlungslauf brach beim Speichern ab | `copilotHistory.currentWeight`/`targetWeight` waren für präzise Gewichtsstrings zu kurz | Nicht-destruktive Spaltenerweiterung auf 32 Zeichen | Schema-Regression und erfolgreicher Vorschlagslauf |

## Fachliche und externe Gegenprüfungen

Die Tool- und Portfoliowerte wurden nicht nur gegen UI-Darstellung, sondern soweit zulässig gegen unabhängige Rechenwege und externe Marktquellen abgegrenzt. Die Monatszinsformel ergab für die vorbelegten Eingaben CHF 300'850.72 und stimmt gerundet mit CHF 300'851 überein. Die geometrische Dividendenreihe ohne Reinvestition bestätigt die sichtbaren Werte von CHF 1'750 laufend, CHF 2'851 im Jahr zehn und CHF 22'011 kumuliert.[2]

Für die Preisstichprobe stimmten die gespeicherten Kaufkurse von ABBN.SW (CHF 79.60) und NOVN.SW (CHF 126.34) mit Yahoo-Referenzwerten überein; UBSG.SW wich nur um 0,37 % ab. Für KGV/PEG wurde kein unzulässiger Drittvergleich konstruiert, nachdem die finnischen SIX-Abfragen in dieser Umgebung verweigert wurden. Die systematische europäische EODHD-Qualitätsproblematik, insbesondere bei SIX-Titeln, bleibt in den separaten Datenqualitätsuntersuchungen belegt.[3] [4]

## Positiv abgegrenzte Beobachtungen

Einige anfängliche Auffälligkeiten erwiesen sich im aktuellen Stand als vorgesehene oder externe Zustände. Diese wurden bewusst nicht durch riskante oder fachlich falsche Änderungen „korrigiert“.

| Beobachtung | Einordnung | Auditentscheidung |
|---|---|---|
| Leere Aktienansicht ohne Suche | Vorgesehener Kachel-Einstieg; Treffer laden erst bei Suche/Filter | Kein Fehler |
| Optimierungstab wirkte zunächst leer | Erweiterte Tabs sind in „Einfach“ absichtlich verborgen; „Detailliert“ zeigt den vollständigen Pfad | Kein Fehler; UX-Hinweis möglich |
| ROG.SW mit „Kurs fehlt“ | Bekannte Symbol-/Vendor-Datenlücke; die UI markiert Wert und Gewicht transparent | Datenqualitätsrisiko, kein UI-Fehler |
| TradingView-Chart im isolierten Browser leer | Iframe und erwartetes SIX-Symbol vorhanden, keine CSP-/JS-Fehler | Externer Einbettungs-/Umgebungsbefund |
| Risikokennzahlen und Scores teilweise „—“ | Für ein neues Portfolio ohne ausreichende Historie fachlich erwartbar und erläutert | Kein Fehler |
| Research mit Zentralbank-/Geldpolitik-Tags | Observatory zeigt vollständig nach Score sortierte n8n-Signale; Tagfilter gehört zum externen n8n→GitHub-Workflow | Kein UI-Fehler |
| KI-Builder-Pflichtfeldfeedback | Verifizierter Handler zeigt Toast; automatisierter Erstklick lag ausserhalb des Viewports | Testartefakt, kein Produktfehler |

## Test- und Release-Gates

Die vierte Auditphase kombinierte Unit-, Integrations- und Browserprüfungen. Nach Ergänzung des Testdoubles für den neuen Cash-Query bestand auch die Charakterisierungsabdeckung des Verkaufs-/Realized-Gains-Pfads wieder vollständig. Der vollständige Lauf endete mit 171 bestandenen Testdateien, 1'431 bestandenen Tests und 11 absichtlich übersprungenen Tests. Die übersprungenen Fälle bleiben opt-in, da sie externe Live-Anbieter ansprechen.[1] [2]

| Gate | Ergebnis |
|---|---|
| Fokusregressionen für Timeout, Frische, Cache, Stückzahl und Cash | 12/12 bestanden |
| Charakterisierungstest CT-5 (Realized Gains/Oversell/FX) | 5/5 bestanden |
| Gesamtsuite | 1'431 bestanden, 11 übersprungen |
| TypeScript und LSP | Keine Fehler |
| Testkonto-Berechtigung nach Audit | Rolle `user` verifiziert |
| Öffentliche Mobile-Ansicht bei 390 px | Kein horizontaler Überlauf, keine Konsolenfehler |

## Verbleibende kontrollierte Risiken

Die nachstehenden Punkte sind **keine offenen Auditdefekte**, sollten aber als betriebliche Daten- oder Drittanbietergrenzen überwacht werden. Sie rechtfertigen keine stillschweigende Fallback-Berechnung oder Datenmanipulation.

| Risiko | Wirkung | Bestehende Kontrolle |
|---|---|---|
| EODHD-Qualität für europäische/SIX-Fundamentals | Fehlende oder auffällige PE-/PEG- und Kursfelder | Datenqualitäts-Review-Queue, Symbolauflösung, Dividendengegenprüfung und dokumentierte Vendoranalyse |
| TradingView-Iframe | Externes Chart kann in einzelnen isolierten Umgebungen unsichtbar bleiben | Korrekte Iframe-Einbettung nachgewiesen; Kernkennzahlen bleiben verfügbar |
| Fehlender frischer Marktbericht | Markt-Hub zeigt temporär keinen KI-Tagesbericht | Bewusster, erklärter Leerzustand statt veralteter oder zukünftiger Aussage |
| Externer n8n-Issue-Tagfilter | Zentralbank-/Geldpolitiksignale können im Research-Feed sichtbar bleiben | Workflow-Grenze ist von der UI getrennt; die n8n-Konfiguration muss separat gepflegt werden |

## Schlussfolgerung

Die Anwendung erfüllt nach den getesteten Remediationen die geprüften Anforderungen an transparente Zustandswechsel, begrenzte KI-Laufzeiten, nachvollziehbare Fehlerkommunikation, aktuelle Marktinhalte und sofort aktualisierte Portfoliozustände. Die vorgenommenen Änderungen sind durch fokussierte Tests, eine vollständige Regression und browsergestützte Nachprüfungen abgesichert. Der detaillierte chronologische Nachweis mit Screenshots, Datenbankzuständen und Einzelbeobachtungen liegt im Arbeitsprotokoll.[2]

## Referenzen

[1]: `manus-webdev://1e785068` — veröffentlichter Checkpoint „Visuelles Audit: …“  
[2]: [VISUAL_AUDIT_WORKLOG_2026-08-21.md](./VISUAL_AUDIT_WORKLOG_2026-08-21.md) — chronologisches Auditprotokoll und Verifikationsnachweise  
[3]: [EODHD_EU_DATA_QUALITY_2026-08-17.md](./EODHD_EU_DATA_QUALITY_2026-08-17.md) — Vergleich europäischer und US-amerikanischer EODHD-Datenqualität  
[4]: [PEG_RATIO_INVESTIGATION_2026-08-17.md](./PEG_RATIO_INVESTIGATION_2026-08-17.md) — KGV-/PEG-Ursachenanalyse
