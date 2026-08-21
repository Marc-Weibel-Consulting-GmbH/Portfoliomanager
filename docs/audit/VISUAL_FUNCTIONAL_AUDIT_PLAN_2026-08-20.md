# Visual- und Funktionsaudit — Prüfplan

**Ziel:** Vollständige, nutzerorientierte Prüfung der Portfolioanwendung mit einem isolierten Testkonto und einem klar gekennzeichneten Testportfolio. Produktive Benachrichtigungen, Zahlungs- und irreversible Löschpfade sind ausgeschlossen.

## Prüfumfang

| Bereich | Kernhandlungen | Erfolgskriterium |
|---|---|---|
| Konto und Navigation | Registrierung/Login, Header, Sidebar, Fehlerseiten, Logout | Kein Navigationstotpunkt, verständliche Fehler- und Leerzustände |
| Aktiensuche und Daten | Suche nach US-, Schweizer- und EU-Titeln, Detailansicht | Treffer, Preise, Kennzahlen und Quellenstatus nachvollziehbar |
| Portfolio | Erstellen, Titel hinzufügen, ändern, kontrolliert entfernen | Persistente, konsistente Positionen und Werte ohne Seiteneffekte ausserhalb des Testportfolios |
| Optimierung | Vorschlag erzeugen, Varianten und Übernahme prüfen | Kein Endlosspinner; Empfehlungen, Kosten und Risiken transparent |
| Performance und Analyse | Zeitreihen, TTWROR, Drawdown, Sharpe/Sortino, Kennzahlen | Werte plausibel, Warnungen sichtbar, keine stille Datenkappung |
| Admin und Screener | Verwaltung, Exporte, Review-Queues, berechtigte Aktionen | Rechte greifen; Datenqualitätsstatus ist sichtbar und erklärbar |
| Drittvergleich | Stichprobe Preise, KGV/PEG, Dividenden, Performanceberechnung | Quelle, Datum und Abweichung pro Stichprobe dokumentiert |

## Schutzregeln

Das Testportfolio trägt eine eindeutige Kennzeichnung. Nur dessen Positionen dürfen angelegt oder entfernt werden. Keine Auslösung von E-Mails, WhatsApp, Zahlungen oder produktiven Alerts. Jeder reproduzierbare Defekt wird vor einer Minimalremediation dokumentiert und danach live erneut getestet.
