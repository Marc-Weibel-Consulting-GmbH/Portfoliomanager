# Research-Triage-Loop — erneute Prüfung

**Repository:** `Marc-Weibel-Consulting-GmbH/Portfoliomanager`  
**Abrufzeitpunkt:** 7. September 2026, 05:04 Uhr (GMT+2)  
**Regel:** Titelpräfix `[Research]`, Label `research`, kein Fortschrittslabel aus `research:spike`, `research:review`, `research:accepted` oder `research:rejected`; maximal zwei Kandidaten.

## Resultat

Die erneute Abfrage aller offenen Issues mit dem Label `research` ergab **sechs offene Research-Issues**, aber **null zulässige Kandidaten**. Jedes Ergebnis trug bereits mindestens ein ausschliessendes Fortschrittslabel. Deshalb wurde keine Hypothese erneut triagiert und keine technische oder finanzielle Schlussfolgerung aus bereits bearbeiteten Issues gezogen.

| Issue | Titel gekürzt | Ausschliessendes Label | Aktion dieses Laufs |
|---:|---|---|---|
| #342 | Profilgerechte Diversifikationsregeln vereinfachen | `research:rejected` | Ausgeschlossen |
| #232 | Bond yield responses to macro news | `research:review` | Ausgeschlossen |
| #216 | Getting the Target Right in Return Prediction | `research:spike` | Ausgeschlossen |
| #215 | Is Trend Still Your Friend? | `research:accepted` | Ausgeschlossen; zusätzlich `research:new` vorhanden |
| #206 | Test — Momentum-Faktor Erweiterung | `research:spike`, `research:review` | Ausgeschlossen |
| #205 | The Intramonth Momentum Cycle | `research:spike`, `research:review` | Ausgeschlossen |

## Konsequenz

Der Protokollfilter ist absichtlich konservativ: Das vorhandene Fortschrittslabel reicht für den Ausschluss, auch wenn ein Issue zugleich ein widersprüchliches weiteres Statuslabel trägt. Es wurden daher **keine** Labels geändert, keine Kommentare gepostet, keine Branches angelegt, keine Prototypen oder Feature-Flags erstellt, keine Backtests ausgeführt und keine Draft-PRs angelegt. Dies verhindert einen parallelen Backtest oder eine doppelte Entscheidung für bereits laufende bzw. abgeschlossene Forschung.

Wenn künftig ein neues `[Research]`-Issue mit ausschliesslich dem Label `research` (und gegebenenfalls `research:new`) offen ist, greift der vorgegebene Ablauf wieder: vollständige technische/OOS-Triage, erst danach gegebenenfalls `research:spike`, ein default-deaktivierter Prototyp und ein reproduzierbarer Backtest.
