# Arbeitsprotokoll: Empfehlungen nach KI-Portfolioerstellung

## Reproduzierter Ausgangszustand

Das Portfolio **„Test KI“** (ID `3510001`) wurde am 19. August 2026 angelegt, ist ein `demo`-Portfolio und besitzt die Kadenz `weekly`. Im Empfehlungen-Tab wurde trotzdem unmittelbar eine Liste mit vierzehn Umschichtungsvorschlägen erzeugt.

## Ursachenanalyse

Die im Screenshot sichtbare Ansicht verwendet nicht den neueren `analytics.upgradeProposals`-Pfad, sondern `copilot.analyze` mit `runCopilotAnalysis`. Der bestehende Sieben-Tage-Schutz für KI-erstellte Demoportfolios liegt ausschliesslich in `analytics.upgradeProposals`; er schützt die wiederkehrenden Copilot-Empfehlungen folglich nicht.

Die Widersprüchlichkeit „KAUF-Signal“ plus „Reduzieren“ entsteht in zwei Schritten. Zuerst erstellt die Rebalancing-Engine aus **portfolio-relativen** Rangwerten gewichtete Zielquoten. Bereits eine aktuelle Quote oberhalb der neu normalisierten Zielquote führt zu `decrease`, auch wenn der Rangwert weiterhin 60 oder höher ist. Anschliessend ergänzt `copilot.analyze` für positive Kernsignale nur den Text „KAUF-Signal“, belässt die vorher berechnete Handelsaktion aber unverändert. Die UI suggeriert damit fälschlich eine direkte Handlungsableitung aus dem Signal.

Der gezeigte Empfehlungen-Tab kann gegenwärtig nur Zielgewichte **bestehender Positionen** ausführen. Daraus entstehen kauf- oder verkaufsseitige Stücktransaktionen für dieselbe Position, die UI bezeichnet sie als „Aufstocken“ oder „Reduzieren“; für sehr tiefe Zielgewichte ist „Verkaufen“ möglich. Einen expliziten Kauf eines neuen Titels oder einen atomar gekoppelten Austausch (Verkauf A → Kauf B) bietet dieser Pfad nicht.

## Festgelegte Korrekturprinzipien

1. Die Schutzfrist gilt auch nach einer Aktivierung und wird anhand einer expliziten KI-Herkunft statt des wechselnden `portfolioType` bestimmt.
2. Während der Schutzfrist werden nur klar bezeichnete Ausnahmen für Datenintegrität oder harte Risikolimits angezeigt; normale Rang-, Momentum- und Rebalancingdeltas werden unterdrückt.
3. Ein positives Signal darf eine Reduzierung nur bei einer explizit kategorisierten übergeordneten Begründung auslösen, beispielsweise Klumpenrisiko oder verbindlichem Maximalgewicht. Ohne diese Kategorie wird die Position als Halten dargestellt.
4. Die UI trennt künftig **Signallage**, **Portfolioentscheidung** und **Handelsaktion** und benennt die Handlung explizit als Aufstocken, Reduzieren, Kaufen, Verkaufen oder Austausch.

## Umgesetzte Korrektur und Live-Nachtest

Die Korrektur führt `creationSource` als additive, bei einer Aktivierung unveränderte Portfolioherkunft ein. Der KI-Wizard schreibt fortan `ai_wizard`; der vom Nutzer eindeutig als KI-Wizard-erstellt benannte Bestandsdatensatz **Test KI** wurde nicht-destruktiv entsprechend nachmarkiert. Für die ersten sieben Kalendertage unterdrückt der laufende Empfehlungsmodus alle normalen Rang- und Rebalancingvorschläge. Zusätzlich wird eine Reduzierung bei positivem Kernsignal ohne explizites Risiko- oder Datenintegritätslimit als Halten klassifiziert.

Der Live-Nachtest wurde am 21. August um 12:42 UTC auf dem Portfolio Test KI gestartet. Er löst ausschliesslich eine Analyse aus; es wurden keine Empfehlungen übernommen und keine Transaktionen erzeugt. Die Ansicht erläutert nun zudem sichtbar, dass der laufende Modus nur bestehende Positionen rebalanciert, während neue Käufe und gekoppelte Austausche in den vollständigen Neuoptimierungsmodus gehören.

Der Abschlusszustand ist live bestätigt: Nach Abschluss der Analyse zeigt die Empfehlungen-Ansicht **„Beobachtungsphase aktiv — keine Umschichtung vorgeschlagen“** und die verbleibenden fünf Kalendertage an. Die zuvor angezeigten vierzehn, zum Kauf-Signal widersprüchlichen Reduzierungen erscheinen nicht mehr.

Die additive Migration `0051_whole_adam_destine.sql` ergänzt die dauerhaft erhaltene Herkunft `creationSource` mit sicherem Standard `manual`; sie wurde vor der Anwendung geprüft und danach nicht-destruktiv auf die Datenbank angewendet. Die vollständige Regression bestätigt den Release mit 177 bestandenen Testdateien, 1'452 bestandenen Tests und elf bewusst übersprungenen opt-in Live-Tests. TypeScript, LSP und die browsergestützte Nachprüfung sind ebenfalls grün.
