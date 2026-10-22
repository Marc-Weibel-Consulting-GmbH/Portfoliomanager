

## Verifizierte Dividendenrenditen: Aker BP und Gesamtuniversum (2026-10-22)
- [x] Aker BP vollständig nachgerechnet: vier reguläre EODHD-TTM-Cash-Ereignisse über NOK 25.180520 bei NOK 386.50 ergeben **6.5133 % TTM-Brutto**. Die sichtbaren 0.68 % waren ein Persistenzfehler, nicht eine niedrige Ausschüttung.
- [x] Ursachenkette universumsweit korrigiert: eine verifizierte TTM-Jahressumme konnte neben einem alten/sekundären Renditewert stehen bleiben. Alle regulären Schreibpfade (täglicher und geplanter Refresh, Admin, Einzel-/Bulk-Aktie, Watchlist-Anreicherung, Hinzufügen, PDF-Import) verwenden jetzt EODHD-Ereignisse → Forward → Providerfallback und speichern Basis, Betrag, Währung, Anzahl, Stichtag und Quelle zusammen.
- [x] Aktive Instrumente kontrolliert aktualisiert: 314 im Scope; 209 TTM-Brutto, 73 Forward/indicated, 32 offene Datenlücken. Der Endabgleich prüft 208 mathematisch berechenbare TTM-Reihen; **0 materielle Abweichungen** (Toleranz 0.05 Prozentpunkte für Intraday-Kursbewegung).
- [x] Londoner GBX/GBP-Handelslinien abgesichert: GBX/Pence wird nur bei expliziter GBX-Basis in GBP-Cash umgerechnet; bereits in GBP gelieferte Linien werden nie ein zweites Mal geteilt. MNG.L 6.6004 % TTM, VWRL.L 1.3390 % TTM und BATS.L 5.5900 % Forward verifiziert.
- [x] Audit: `docs/audit/VERIFIED_DIVIDEND_YIELD_INTEGRITY_AUDIT_2026-10-22.md`; keine Rohpreis-, Portfolio-, Cash-, Ledger-, Transaktions- oder Handelsmutation.
- [x] Abschlussprüfung: 266 Testdateien / 1'785 Tests bestanden, 5 / 11 übersprungen; TypeScript und `git diff --check` fehlerfrei. Devserver-Route bis zum Login-Gate sowie Browserkonsole (0 Fehler) geprüft.
