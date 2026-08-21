# Optimierungs-UX: Profilgerechte Diversifikation

## Ausgangsbefund

Das Portfolio **Test KI** wurde im KI-Wizard mit der bewussten Wahl **„nur Aktien“** angelegt. Die Optimierungsansicht leitete die Anlageklassenregeln jedoch ausschliesslich aus dem allgemeinen Profil „Ausgewogen“ ab. Dadurch erschienen Sollquoten für Obligationen, Rohstoffe, Gold und Immobilien als Warnungen, obwohl diese Anlageklassen ausdrücklich nicht Teil der Strategie waren.

Zugleich war die Volloptimierung in der Standardansicht überladen: sämtliche erfüllten Regeln, Upgrade-Details, mathematische Kennzahlen, Effizienzdiagramm und lange Titelauflistungen waren ohne Priorisierung sichtbar.

## Ursachen und Korrektur

Die Anlageklassenwahl `stocksOnly` wurde beim Vorschlagsjob verwendet, aber nicht in `portfolioData` des endgültig angelegten Portfolios gespeichert. Damit stand dem Detailbereich kein stabiler Portfoliovertrag zur Verfügung. Der Wizard persistiert jetzt `allocationScope: 'stocks_only'` bzw. `profile_mix`. Für bestehende, vom Nutzer eindeutig bestätigte KI-Portfolio „Test KI“ wurde ausschliesslich dieses fehlende Metadatum ergänzt.

Der Optimierungstab verwendet den gespeicherten Vertrag vor Profilzielen: Bei `stocks_only` werden Anlageklassenbandbreiten vollständig unterdrückt. Die Regelübersicht heisst nun **„Aktien-Diversifikation“**, öffnet standardmässig geschlossen und zeigt beim Öffnen nur tatsächlichen Handlungsbedarf. Erfüllte Regeln bleiben über „Alle Regeln anzeigen“ bewusst verfügbar.

Die Volloptimierung startet ausserdem mit geschlossenen Upgrade- und technischen Blöcken. Gewichtstabellen und Effizienzgrenze liegen hinter **„Technische Optimierungsdetails“**. Der Mindestpositionshinweis nennt nur Anzahl und Wirkung; die lange Tickerliste erscheint erst nach einem expliziten Klick. Der Profilkopf trennt zudem **Risikoprofil**, **Ziel** und **Strategie: nur Aktien**.

## Verifikation

Die neue Präsentationsregression deckt vier Verträge ab: Unterdrückung der Profil-Anlageklassenregeln für die Aktienstrategie, Beibehaltung für Multi-Asset, Kurzansicht nur mit Handlungsbedarf und vollständige Regelansicht auf Nachfrage. Sie besteht zusammen mit der TypeScript-Prüfung.

Die vollständige Suite endete mit **178 bestandenen Testdateien** und **1'456 bestandenen Tests**; elf externe Live-Tests bleiben bewusst opt-in. Die Liveprüfung am Portfolio `3510001` bestätigte: Profilkopf „Strategie: nur Aktien“, keine Warnungen zu Obligationen/Rohstoffen/Gold/Immobilien, drei echte Aktienprüfpunkte sowie standardmässig geschlossene Upgrade- und technische Blöcke.
