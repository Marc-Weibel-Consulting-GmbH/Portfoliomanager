import mysql from 'mysql2/promise';

// Expanded moat descriptions (1-2 sentences each)
const expandedMoats = {
  "EOSE": {
    moat1: "Eos Energy besitzt wichtige Patente für Zink-Batterietechnologie, die kostengünstiger und langlebiger ist als herkömmliche Lithium-Ionen-Batterien. Diese Technologie ermöglicht längere Lebensdauer und niedrigere Gesamtbetriebskosten.",
    moat2: "Durch strategische Partnerschaften mit großen Energiekonzernen profitiert Eos von Skaleneffekten und beschleunigter Marktdurchdringung. Diese Kooperationen sichern langfristige Abnahmeverträge und Finanzierung.",
    moat3: "Der Fokus auf nachhaltige Energiespeicherung positioniert Eos optimal für regulatorische Vorteile und staatliche Förderungen. Die umweltfreundliche Zink-Technologie erfüllt strenge Nachhaltigkeitskriterien."
  },
  "DELL": {
    moat1: "Dell kontrolliert die gesamte Wertschöpfungskette von Hardware bis Software, was Kostenvorteile und bessere Qualitätskontrolle ermöglicht. Diese vertikale Integration schafft höhere Margen und schnellere Innovation.",
    moat2: "Eine etablierte Enterprise-Kundenbasis mit hohen Wechselkosten sorgt für wiederkehrende Umsätze und Loyalität. Langfristige Serviceverträge und IT-Infrastruktur-Abhängigkeit binden Kunden.",
    moat3: "Dell dominiert den Markt für AI-Server mit führendem Marktanteil und spezialisierter Hardware. Die Expertise in Hochleistungsrechenzentren positioniert Dell ideal für die AI-Revolution."
  },
  "ALAB": {
    moat1: "Astera Labs entwickelt spezialisierte Chips für AI-Datenübertragung, die kritisch für moderne Rechenzentren sind. Diese Nischenprodukte lösen Engpässe in der AI-Infrastruktur.",
    moat2: "Hohe F&E-Investitionen sichern kontinuierliche Innovation und technologischen Vorsprung. Das Unternehmen investiert über 40% des Umsatzes in Forschung und Entwicklung.",
    moat3: "In diesem spezialisierten Marktsegment gibt es nur wenige Wettbewerber mit vergleichbarer Expertise. Die hohen Eintrittsbarrieren schützen die Marktposition."
  },
  "ANET": {
    moat1: "Arista Networks ist führend in Cloud-Netzwerklösungen mit überlegener Performance und Zuverlässigkeit. Die Produkte sind speziell für hyperscale Rechenzentren optimiert.",
    moat2: "Langfristige Kundenbeziehungen mit großen Cloud-Providern wie Microsoft und Meta schaffen stabile Umsatzströme. Diese Partnerschaften sind schwer zu replizieren.",
    moat3: "Proprietäre Software-Plattform EOS bietet einzigartige Automatisierungs- und Analysefunktionen. Diese Software-Differenzierung schafft Wettbewerbsvorteile gegenüber traditionellen Hardware-Anbietern."
  },
  "AMD": {
    moat1: "AMD's Chiplet-Architektur ermöglicht flexiblere und kosteneffizientere Prozessordesigns als monolithische Chips. Diese Innovation reduziert Produktionskosten und beschleunigt Time-to-Market.",
    moat2: "Starke Position im Rechenzentrumsmarkt mit EPYC-Prozessoren, die Intel Marktanteile abnehmen. AMD bietet besseres Preis-Leistungs-Verhältnis bei Serveranwendungen.",
    moat3: "Wachsende Präsenz im AI-Chip-Markt mit MI300-Serie, die NVIDIA herausfordert. Die offene Software-Strategie zieht Entwickler an."
  },
  "MU": {
    moat1: "Micron ist einer der wenigen globalen Hersteller von DRAM und NAND-Speicher mit eigener Fertigungstechnologie. Hohe Kapitalintensität schafft Eintrittsbarrieren.",
    moat2: "Führend in High-Bandwidth Memory (HBM) für AI-Anwendungen, ein schnell wachsender Markt. Diese Spezialtechnologie ist kritisch für moderne AI-Chips.",
    moat3: "Zyklische Industrie mit Konsolidierung - nur drei große Player kontrollieren den Markt. Oligopolistische Marktstruktur ermöglicht bessere Preisdisziplin."
  },
  "IREN": {
    moat1: "IREN betreibt Bitcoin-Mining mit erneuerbarer Energie, was niedrigere Betriebskosten und ESG-Vorteile bietet. Zugang zu günstiger Wasserkraft schafft Kostenvorteile.",
    moat2: "Strategische Standorte in Regionen mit überschüssiger Energie ermöglichen profitable Mining-Operationen. Das Unternehmen nutzt sonst verschwendete Energie.",
    moat3: "Diversifikation in AI-Computing und Cloud-Services reduziert Abhängigkeit von Bitcoin-Preisen. Die bestehende Infrastruktur kann für AI-Workloads genutzt werden."
  },
  "CIFR": {
    moat1: "Cipher Mining verfügt über moderne, energieeffiziente Mining-Infrastruktur mit niedrigen Stromkosten. Die neueste ASIC-Hardware maximiert die Mining-Effizienz.",
    moat2: "Langfristige Stromabnahmeverträge sichern vorhersehbare Betriebskosten. Diese Verträge schützen vor Energiepreisvolatilität.",
    moat3: "Skalierbare Infrastruktur ermöglicht schnelle Expansion bei steigenden Bitcoin-Preisen. Das Unternehmen kann Kapazität flexibel anpassen."
  },
  "MONC.MI": {
    moat1: "Moncler ist eine Premium-Luxusmarke mit starker Markenwiedererkennung und Preissetzungsmacht. Die Marke steht für Qualität und Status.",
    moat2: "Vertikale Integration und Kontrolle über Distribution sichern hohe Margen. Eigene Boutiquen und selektive Wholesale-Partner schützen das Markenimage.",
    moat3: "Erfolgreiche Diversifikation mit Stone Island erweitert das Produktportfolio. Multi-Brand-Strategie reduziert Abhängigkeit von einer einzelnen Marke."
  },
  "APP": {
    moat1: "AppLovin's AI-gestützte Werbeplattform AXON bietet überlegene Targeting- und Optimierungsfähigkeiten. Machine Learning verbessert kontinuierlich die Performance.",
    moat2: "Eigene Mobile-Gaming-Studios generieren First-Party-Daten und Umsätze. Diese vertikale Integration schafft Synergien zwischen Gaming und Werbung.",
    moat3: "Netzwerkeffekte: Je mehr Entwickler die Plattform nutzen, desto wertvoller wird sie. Die Plattform profitiert von steigender Liquidität."
  },
  "SU.PA": {
    moat1: "Schneider Electric ist globaler Marktführer in Energiemanagement und Automatisierung mit umfassendem Produktportfolio. Die Lösungen decken die gesamte Energiekette ab.",
    moat2: "Starke Marktposition in Rechenzentrumsinfrastruktur, einem wachsenden Segment. Kritische Produkte für Energieeffizienz und Kühlung.",
    moat3: "Software- und Service-Geschäft schafft wiederkehrende Umsätze und höhere Margen. Digitale Plattformen binden Kunden langfristig."
  },
  "MELI": {
    moat1: "MercadoLibre dominiert E-Commerce in Lateinamerika mit führenden Marktanteilen in mehreren Ländern. Die Plattform ist die erste Anlaufstelle für Online-Shopping.",
    moat2: "Mercado Pago ist das größte Fintech-Ökosystem in der Region mit Zahlungen, Krediten und Investments. Finanzdienstleistungen schaffen zusätzliche Monetarisierung.",
    moat3: "Eigene Logistikinfrastruktur (Mercado Envios) ermöglicht schnellere Lieferungen und bessere Kundenerfahrung. Diese Infrastruktur ist schwer zu replizieren."
  },
  "SQN.SW": {
    moat1: "Swissquote ist führende digitale Bank in der Schweiz mit starker Technologieplattform. Die vollständig digitale Infrastruktur ermöglicht niedrige Kosten.",
    moat2: "Umfassendes Produktangebot von Trading über Banking bis Krypto aus einer Hand. Diese Diversifikation zieht verschiedene Kundensegmente an.",
    moat3: "Schweizer Banklizenz und Regulierung schaffen Vertrauen und Eintrittsbarrieren. Die Reputation als sichere Bank ist ein wichtiger Wettbewerbsvorteil."
  },
  "LISN.SW": {
    moat1: "Lindt besitzt eine der stärksten Premium-Schokoladenmarken weltweit mit außergewöhnlicher Preissetzungsmacht. Die Marke steht für Schweizer Qualität und Luxus.",
    moat2: "Vertikale Integration von Kakaobeschaffung bis Einzelhandel sichert Qualitätskontrolle und Margen. Eigene Boutiquen maximieren die Markenerfahrung.",
    moat3: "Globale Präsenz mit starkem Wachstum in Schwellenländern erschließt neue Märkte. Die Premiumpositionierung funktioniert kulturübergreifend."
  },
  "SCMN.SW": {
    moat1: "Swisscom ist faktisches Telekom-Monopol in der Schweiz mit dominanter Marktposition. Die Infrastruktur ist schwer zu duplizieren.",
    moat2: "Hohe Eintrittsbarrieren durch massive Infrastrukturinvestitionen schützen die Position. Neue Wettbewerber müssen Milliarden investieren.",
    moat3: "Stabile Cashflows aus Mobilfunk und Festnetz finanzieren Dividenden und 5G-Ausbau. Das Geschäftsmodell ist sehr vorhersehbar."
  },
  "TSM": {
    moat1: "TSMC ist weltweit führender Chip-Auftragsfertiger mit technologischem Vorsprung von 1-2 Generationen. Die fortschrittlichsten Prozesse sind exklusiv bei TSMC verfügbar.",
    moat2: "Massive Kapitalinvestitionen (über $40 Mrd. jährlich) schaffen unüberwindbare Eintrittsbarrieren. Neue Fabs kosten Milliarden und brauchen Jahre.",
    moat3: "Kundenliste umfasst Apple, NVIDIA, AMD - praktisch alle führenden Chip-Designer. Diese Abhängigkeit sichert langfristige Aufträge."
  },
  "AVGO": {
    moat1: "Broadcom dominiert Nischenmärkte für spezialisierte Chips mit hohen Margen. Die Produkte sind oft mission-critical ohne echte Alternativen.",
    moat2: "Akquisitionsstrategie erweitert kontinuierlich das Portfolio und eliminiert Wettbewerber. VMware-Übernahme stärkt Software-Geschäft.",
    moat3: "Langfristige Kundenbeziehungen mit hohen Wechselkosten sichern wiederkehrende Umsätze. Chips sind tief in Kundendesigns integriert."
  },
  "KNIN.SW": {
    moat1: "Kühne + Nagel ist einer der größten Logistikdienstleister weltweit mit globaler Präsenz. Das Netzwerk umfasst über 1.300 Standorte in 100+ Ländern.",
    moat2: "Spezialisierung in komplexer Kontraktlogistik für Pharma und High-Tech schafft Expertise-Vorteile. Diese Branchen haben hohe Qualitätsanforderungen.",
    moat3: "Asset-light Geschäftsmodell ermöglicht hohe Kapitalrenditen und Flexibilität. Das Unternehmen besitzt keine Flugzeuge oder Schiffe."
  },
  "SGKN.SW": {
    moat1: "St. Galler Kantonalbank profitiert von Staatsgarantie, die Vertrauen und günstige Refinanzierung sichert. Diese Garantie ist ein einzigartiger Wettbewerbsvorteil.",
    moat2: "Dominante Marktposition in der Region St. Gallen mit tiefen Kundenbeziehungen. Lokale Verwurzelung schafft Loyalität.",
    moat3: "Konservatives Geschäftsmodell mit Fokus auf Hypotheken generiert stabile Erträge. Niedriges Risikoprofil ermöglicht attraktive Dividenden."
  },
  "NVDA": {
    moat1: "NVIDIA dominiert AI-Chips mit über 80% Marktanteil und technologischem Vorsprung. Die H100/H200 GPUs sind der Industriestandard für AI-Training.",
    moat2: "CUDA Software-Ökosystem bindet Entwickler und schafft hohe Wechselkosten. Millionen von Entwicklern sind mit CUDA vertraut.",
    moat3: "Vertikale Integration von Chips über Netzwerk bis Software ermöglicht optimierte Gesamtsysteme. Diese End-to-End-Lösungen sind schwer zu replizieren."
  },
  "NEE": {
    moat1: "NextEra ist weltgrößter Produzent von Wind- und Solarenergie mit massivem Skalenvorsprung. Die Größe ermöglicht günstigere Finanzierung und Beschaffung.",
    moat2: "Regulierte Utility-Geschäft in Florida generiert stabile, vorhersehbare Cashflows. Diese Basis finanziert Wachstumsinvestitionen.",
    moat3: "Führend in Energiespeicherung mit wachsendem Batterie-Portfolio. Diese Technologie ist kritisch für erneuerbare Energien."
  },
  "JNJ": {
    moat1: "Johnson & Johnson besitzt ein diversifiziertes Portfolio von über 250 Marken in Pharma, MedTech und Consumer Health. Diese Diversifikation reduziert Risiken.",
    moat2: "Starke Innovationspipeline mit über 50 Medikamenten in später Entwicklung. Hohe F&E-Ausgaben sichern zukünftiges Wachstum.",
    moat3: "AAA-Kreditrating ermöglicht günstigste Finanzierung und finanzielle Stabilität. Nur zwei US-Unternehmen haben dieses Rating."
  },
  "TSLA": {
    moat1: "Tesla dominiert den Markt für Elektrofahrzeuge mit führendem Marktanteil und Markenwiedererkennung. Die Marke ist synonym mit EVs.",
    moat2: "Autopilot-Software und Full Self-Driving schaffen Differenzierung und zukünftige Monetarisierung. Die Datensammlung von Millionen Fahrzeugen ist einzigartig.",
    moat3: "Vertikale Integration von Batterieproduktion bis Ladenetzwerk (Supercharger) kontrolliert die gesamte Wertschöpfungskette. Das Supercharger-Netzwerk ist ein wichtiger Wettbewerbsvorteil."
  },
  "NESN.SW": {
    moat1: "Nestlé ist weltgrößter Lebensmittelkonzern mit über 2.000 Marken und globaler Reichweite. Die Größe ermöglicht Skalenvorteile in Beschaffung und Distribution.",
    moat2: "Portfolio von starken Marken (Nespresso, KitKat, Maggi) mit hoher Kundenloyalität. Diese Marken rechtfertigen Premium-Preise.",
    moat3: "Führend in Ernährungswissenschaft und Innovation mit eigenen Forschungszentren. Diese Expertise ermöglicht gesündere Produktformulierungen."
  },
  "GOOGL": {
    moat1: "Google dominiert Online-Suche mit über 90% Marktanteil und unübertroffener Datensammlung. Die Suchqualität verbessert sich kontinuierlich durch Machine Learning.",
    moat2: "YouTube ist die zweitgrößte Suchmaschine und dominante Video-Plattform. Die Plattform profitiert von starken Netzwerkeffekten.",
    moat3: "Cloud-Geschäft (GCP) wächst schnell mit Fokus auf AI-Infrastruktur. Google's AI-Expertise ist ein wichtiger Differentiator."
  },
  "NOVO-B.CO": {
    moat1: "Novo Nordisk dominiert den Diabetes-Markt mit führenden Insulinen und GLP-1-Medikamenten. Ozempic und Wegovy sind Blockbuster-Medikamente.",
    moat2: "Jahrzehntelange Expertise in Proteinproduktion schafft Fertigungsvorteile. Diese Kompetenz ist schwer zu replizieren.",
    moat3: "Starke Pipeline mit neuen GLP-1-Varianten und Kombinationstherapien. Der Markt für Adipositas-Medikamente wächst explosiv."
  },
  "META": {
    moat1: "Meta kontrolliert die größten Social-Media-Plattformen (Facebook, Instagram, WhatsApp) mit über 3 Milliarden Nutzern. Diese Netzwerkeffekte sind extrem stark.",
    moat2: "Führende Werbe-Targeting-Technologie ermöglicht präzise Zielgruppenansprache. Die Datensammlung ist unübertroffen.",
    moat3: "Massive Investitionen in AI und Metaverse positionieren Meta für zukünftige Plattformen. Reality Labs entwickelt die nächste Computing-Plattform."
  },
  "AMZN": {
    moat1: "Amazon dominiert E-Commerce in den USA mit über 40% Marktanteil und Prime-Ökosystem. Prime-Mitgliedschaft bindet Kunden langfristig.",
    moat2: "AWS ist führender Cloud-Provider mit höchsten Margen im Konzern. Die Cloud-Infrastruktur finanziert E-Commerce-Expansion.",
    moat3: "Logistiknetzwerk mit Same-Day-Delivery ist schwer zu replizieren. Diese Infrastruktur schafft massive Eintrittsbarrieren."
  },
  "FHZN.SW": {
    moat1: "Flughafen Zürich ist faktisches Monopol als Schweizer Hub mit begrenzter Konkurrenz. Die geografische Lage ist einzigartig.",
    moat2: "Langfristige Konzessionen und regulierte Gebühren sichern stabile Einnahmen. Das Geschäftsmodell ist sehr vorhersehbar.",
    moat3: "Retail- und Immobiliengeschäft diversifiziert Einnahmequellen über Flugverkehr hinaus. Diese Segmente haben höhere Margen."
  },
  "V": {
    moat1: "Visa betreibt das größte Zahlungsnetzwerk weltweit mit unübertroffener Akzeptanz. Die Netzwerkeffekte sind extrem stark.",
    moat2: "Asset-light Geschäftsmodell mit Margen über 50% generiert massive Cashflows. Visa trägt kein Kreditrisiko.",
    moat3: "Duopol mit Mastercard in vielen Märkten ermöglicht Preissetzungsmacht. Regulierung schützt vor neuen Wettbewerbern."
  },
  "SREN.SW": {
    moat1: "Swiss Re ist einer der größten Rückversicherer weltweit mit diversifiziertem Risikoportfolio. Die Größe ermöglicht bessere Risikostreuung.",
    moat2: "Expertise in komplexen Risiken (Naturkatastrophen, Cyber) schafft Wettbewerbsvorteile. Diese Spezialisierung ist schwer aufzubauen.",
    moat3: "Starke Kapitalbasis und AAA-Rating ermöglichen Übernahme großer Risiken. Finanzielle Stärke ist kritisch im Rückversicherungsgeschäft."
  },
  "GALE.SW": {
    moat1: "Galenica ist führende Apothekenkette in der Schweiz mit über 500 Standorten. Die Dichte des Netzwerks schafft Bequemlichkeit.",
    moat2: "Vertikale Integration von Pharmagroßhandel bis Retail sichert Margen. Diese Integration ist einzigartig in der Schweiz.",
    moat3: "Digitale Services (Online-Apotheke, Gesundheitsplattform) erweitern das Geschäftsmodell. Die Omnichannel-Strategie bindet Kunden."
  },
  "MC.PA": {
    moat1: "LVMH besitzt das stärkste Portfolio von Luxusmarken weltweit (Louis Vuitton, Dior, Tiffany). Diese Marken haben jahrhundertelange Geschichte.",
    moat2: "Vertikale Integration kontrolliert die gesamte Wertschöpfungskette von Handwerk bis Retail. Diese Kontrolle schützt das Markenimage.",
    moat3: "Globale Präsenz mit starkem Wachstum in China erschließt wohlhabende Konsumenten. Die Diversifikation über Regionen reduziert Risiken."
  },
  "SLHN.SW": {
    moat1: "Swiss Life ist führender Lebensversicherer in der Schweiz mit starker Marktposition. Die Marke steht für Sicherheit und Vertrauen.",
    moat2: "Diversifikation in Vermögensverwaltung und Immobilien reduziert Abhängigkeit von Versicherung. Diese Segmente wachsen schneller.",
    moat3: "Konservatives Anlageportfolio und starke Kapitalisierung sichern Stabilität. Die Solvenzquote liegt deutlich über regulatorischen Anforderungen."
  },
  "HOLN.SW": {
    moat1: "Holcim ist weltgrößter Baustoffhersteller mit globaler Präsenz und Skalenvorteilen. Die Größe ermöglicht günstigere Beschaffung und Produktion.",
    moat2: "Fokus auf nachhaltige Baustoffe (CO2-reduzierter Zement) positioniert Holcim für Energiewende. Diese Innovation erfüllt strenger werdende Regulierung.",
    moat3: "Lokale Produktionsnetzwerke reduzieren Transportkosten und CO2-Emissionen. Zement ist ein lokales Geschäft mit hohen Transportkosten."
  },
  "MSFT": {
    moat1: "Microsoft dominiert Enterprise-Software mit Office 365 und Azure Cloud. Die Produkte sind tief in Unternehmens-IT integriert.",
    moat2: "Azure ist zweitgrößter Cloud-Provider mit starkem Wachstum und AI-Fokus. Die Partnerschaft mit OpenAI ist ein wichtiger Differentiator.",
    moat3: "Gaming-Geschäft (Xbox, Activision Blizzard) diversifiziert Einnahmequellen. Diese Akquisition schafft das drittgrößte Gaming-Unternehmen."
  },
  "BKW.SW": {
    moat1: "BKW ist integrierter Energieversorger in der Schweiz mit eigener Stromerzeugung. Die Wasserkraft-Assets sind langlebig und profitabel.",
    moat2: "Diversifikation in Energiedienstleistungen (Gebäudetechnik, Engineering) reduziert Regulierungsrisiken. Diese Segmente wachsen schneller.",
    moat3: "Starke Marktposition in der Schweiz mit stabilen regulierten Erträgen. Das Geschäftsmodell ist sehr vorhersehbar."
  },
  "CMBN.SW": {
    moat1: "Cembra ist spezialisierter Konsumkreditanbieter in der Schweiz mit starker Marktposition. Die Expertise in Kreditrisiko ist ein Wettbewerbsvorteil.",
    moat2: "Partnerschaften mit Händlern (z.B. IKEA) sichern Kreditvolumen am Point-of-Sale. Diese Distribution ist kosteneffizient.",
    moat3: "Digitale Plattform ermöglicht effiziente Kreditvergabe mit niedrigen Kosten. Die Automatisierung verbessert kontinuierlich die Margen."
  },
  "AXON": {
    moat1: "Axon dominiert den Markt für Polizei-Bodycams und Taser mit über 80% Marktanteil. Die Produkte sind der Industriestandard.",
    moat2: "Software-Plattform Evidence.com bindet Kunden langfristig mit wiederkehrenden Umsätzen. Die Cloud-Lösung speichert kritische Beweismittel.",
    moat3: "Netzwerkeffekte: Je mehr Behörden Axon nutzen, desto wertvoller wird die Plattform. Die Integration zwischen Behörden verbessert die Zusammenarbeit."
  },
  "PATH": {
    moat1: "UiPath ist führende Robotic Process Automation (RPA) Plattform mit umfassendem Feature-Set. Die Software automatisiert repetitive Aufgaben.",
    moat2: "Große installierte Basis mit über 10.000 Kunden schafft Netzwerkeffekte. Die Community trägt zu Innovationen bei.",
    moat3: "AI-Integration erweitert Automatisierungsmöglichkeiten über einfache Prozesse hinaus. Die Plattform entwickelt sich zu intelligenter Automatisierung."
  },
  "CSL": {
    moat1: "Carlisle ist diversifizierter Industriekonzern mit führenden Positionen in Nischenmärkten. Die Geschäftsbereiche haben hohe Margen.",
    moat2: "Fokus auf Bauprodukte (Dächer, Isolierung) profitiert von Infrastrukturinvestitionen. Diese Märkte sind weniger zyklisch.",
    moat3: "Akquisitionsstrategie erweitert kontinuierlich das Portfolio. Die Integration von Übernahmen ist eine Kernkompetenz."
  },
  "TRMB": {
    moat1: "Trimble ist führend in GPS-Technologie für Bau, Landwirtschaft und Transport. Die Lösungen verbessern Produktivität und Präzision.",
    moat2: "Software-Geschäft mit wiederkehrenden Umsätzen wächst schneller als Hardware. Die Plattform bindet Kunden langfristig.",
    moat3: "Spezialisierung in Nischenmärkten mit hohen Wechselkosten schützt Marktposition. Die Lösungen sind tief in Kundenprozesse integriert."
  },
  "SNPS": {
    moat1: "Synopsys ist führender Anbieter von Electronic Design Automation (EDA) Software. Diese Tools sind essentiell für Chip-Design.",
    moat2: "Duopol mit Cadence in vielen EDA-Bereichen ermöglicht Preissetzungsmacht. Die Wechselkosten sind extrem hoch.",
    moat3: "Expansion in Chip-IP und Software-Security diversifiziert Einnahmequellen. Diese Segmente wachsen schneller als traditionelle EDA."
  },
  "SOFI": {
    moat1: "SoFi ist digitale Bank mit integriertem Fintech-Ökosystem (Banking, Lending, Investing). Die Plattform deckt alle Finanzbedürfnisse ab.",
    moat2: "Eigene Banklizenz ermöglicht günstigere Refinanzierung und höhere Margen. Diese Lizenz ist ein wichtiger Wettbewerbsvorteil.",
    moat3: "Starke Marke bei jüngeren, wohlhabenden Kunden mit hohem Lifetime Value. Die Zielgruppe ist attraktiv für Cross-Selling."
  },
  "CRWD": {
    moat1: "CrowdStrike ist führend in Cloud-native Endpoint Security mit überlegener Technologie. Die Falcon-Plattform nutzt AI für Bedrohungserkennung.",
    moat2: "Netzwerkeffekte: Je mehr Kunden, desto besser die Bedrohungsintelligenz. Die Datensammlung verbessert kontinuierlich die Erkennung.",
    moat3: "Hohe Kundenbindung mit über 120% Net Retention Rate. Kunden erweitern kontinuierlich ihre Nutzung der Plattform."
  },
  "PLTR": {
    moat1: "Palantir ist führend in Big Data Analytics für Regierung und Enterprise. Die Software löst komplexeste Datenintegrationsprobleme.",
    moat2: "Langfristige Regierungsverträge (CIA, DoD) sichern stabile Einnahmen. Diese Kunden haben hohe Sicherheitsanforderungen.",
    moat3: "AI-Plattform (AIP) ermöglicht Unternehmen, Large Language Models zu nutzen. Diese Lösung adressiert einen riesigen Markt."
  },
  "MOH": {
    moat1: "Molina Healthcare ist spezialisiert auf Medicaid Managed Care mit Fokus auf Unterversorgung. Diese Expertise ist ein Wettbewerbsvorteil.",
    moat2: "Starke Beziehungen zu staatlichen Behörden sichern Vertragsgewinne. Die Erfolgsbilanz bei Medicaid ist ausgezeichnet.",
    moat3: "Skalenvorteile in Administration und Netzwerkverhandlungen verbessern Margen. Die Größe ermöglicht bessere Preise mit Anbietern."
  },
  "KLAC": {
    moat1: "KLA ist führend in Prozess-Kontrollausrüstung für Chip-Fertigung. Diese Systeme sind kritisch für Qualitätssicherung.",
    moat2: "Hohe Eintrittsbarrieren durch technologische Komplexität schützen Marktposition. Die Entwicklung neuer Systeme dauert Jahre.",
    moat3: "Wiederkehrende Umsätze aus Services und Upgrades stabilisieren Geschäft. Die installierte Basis generiert kontinuierliche Einnahmen."
  },
  "MDB": {
    moat1: "MongoDB ist führende NoSQL-Datenbank mit überlegener Entwicklererfahrung. Die Flexibilität ist ideal für moderne Anwendungen.",
    moat2: "Open-Source-Strategie schafft große Community und schnelle Adoption. Die Community trägt zu Innovation und Support bei.",
    moat3: "Atlas Cloud-Service mit wiederkehrenden Umsätzen wächst schnell. Diese Managed-Service-Plattform hat höhere Margen."
  },
  "RMD": {
    moat1: "ResMed ist führend in Schlafapnoe-Therapie mit innovativen CPAP-Geräten. Die Produkte verbessern Lebensqualität von Millionen.",
    moat2: "Cloud-verbundene Geräte ermöglichen Fernüberwachung und bessere Therapietreue. Diese Daten schaffen Mehrwert für Ärzte und Patienten.",
    moat3: "Starke Marktposition mit hohen Wechselkosten für Patienten. Die Therapie ist langfristig und Patienten bleiben bei bewährten Lösungen."
  },
  "ARM": {
    moat1: "ARM dominiert mobile Prozessor-Architektur mit über 95% Marktanteil. Praktisch alle Smartphones nutzen ARM-Designs.",
    moat2: "Lizenzmodell ermöglicht hohe Margen ohne Fertigungsrisiko. Die Royalties sind wiederkehrende Einnahmen.",
    moat3: "Expansion in Server und AI-Chips diversifiziert über Mobile hinaus. ARM-basierte Server gewinnen Marktanteile."
  },
  "MRVL": {
    moat1: "Marvell ist führend in Dateninfrastruktur-Chips für Cloud und 5G. Die Produkte sind kritisch für moderne Netzwerke.",
    moat2: "Custom-Chip-Designs für große Cloud-Provider sichern langfristige Umsätze. Diese Partnerschaften sind strategisch wichtig.",
    moat3: "Starke Position in optischen Verbindungen für AI-Cluster. Diese Technologie ist kritisch für moderne Rechenzentren."
  },
  "NTLA": {
    moat1: "Intellia Therapeutics ist führend in CRISPR-Gentherapie mit klinischen Erfolgen. Die Technologie kann genetische Krankheiten heilen.",
    moat2: "Breite Pipeline mit Therapien für Leber-, Blut- und Nervenkrankheiten. Die Plattform ist vielseitig einsetzbar.",
    moat3: "Starke Patentposition und Partnerschaften mit Pharmakonzernen. Diese Kooperationen finanzieren Entwicklung und sichern Kommerzialisierung."
  },
  "TEM": {
    moat1: "Tempus nutzt AI für personalisierte Krebstherapie mit umfassender genomischer Datenbank. Die Daten verbessern Behandlungsentscheidungen.",
    moat2: "Partnerschaften mit führenden Krebszentren sichern Datenzugang und Adoption. Diese Netzwerke sind schwer aufzubauen.",
    moat3: "Expansion in weitere Krankheitsbereiche (Neurologie, Psychiatrie) diversifiziert. Die Plattform ist auf andere Bereiche übertragbar."
  },
  "HIMS": {
    moat1: "Hims & Hers ist führende Telemedizin-Plattform für sensible Gesundheitsthemen. Die Diskretion und Bequemlichkeit sind wichtige Differenziatoren.",
    moat2: "Vertikale Integration von Beratung bis Medikamentenversand kontrolliert Kundenerfahrung. Diese Integration ermöglicht höhere Margen.",
    moat3: "Expansion in GLP-1-Medikamente (Gewichtsverlust) erschließt riesigen Markt. Die Plattform ist ideal für diese Therapie."
  },
  "VST": {
    moat1: "Vistra ist größter unabhängiger Stromerzeuger in den USA mit diversifiziertem Portfolio. Die Größe ermöglicht Skalenvorteile.",
    moat2: "Starke Position in Texas mit hohen Strompreisen und Nachfrage. Der deregulierte Markt ermöglicht höhere Margen.",
    moat3: "Investitionen in Batteriespeicher und erneuerbare Energien positionieren für Energiewende. Diese Assets werden wertvoller."
  },
  "REMX": {
    moat1: "VanEck Rare Earth ETF bietet diversifizierten Zugang zu Seltenen Erden. Diese Materialien sind kritisch für Elektromobilität und Elektronik.",
    moat2: "China dominiert Produktion, aber Diversifikation außerhalb Chinas wächst. Geopolitische Spannungen treiben Nachfrage nach alternativen Quellen.",
    moat3: "Wachsende Nachfrage durch Energiewende und Elektrifizierung. Seltene Erden sind essentiell für Magnete in Elektromotoren."
  },
  "BE": {
    moat1: "Bloom Energy produziert Festoxid-Brennstoffzellen für dezentrale Stromerzeugung. Diese Technologie ist effizienter als traditionelle Generatoren.",
    moat2: "Expansion in Wasserstoff-Elektrolyse erschließt wachsenden Markt. Die Technologie ist auf Wasserstoffproduktion übertragbar.",
    moat3: "Langfristige Serviceverträge mit Fortune 500-Unternehmen sichern wiederkehrende Umsätze. Diese Kunden schätzen Zuverlässigkeit."
  },
  "CRWV": {
    moat1: "CoreWeave ist spezialisierter Cloud-Provider für AI-Workloads mit optimierter Infrastruktur. Die GPU-Cluster sind für AI-Training ausgelegt.",
    moat2: "Langfristige Verträge mit AI-Unternehmen sichern Auslastung. Die Nachfrage nach AI-Rechenkapazität übersteigt das Angebot.",
    moat3: "Schnellere Skalierung als traditionelle Cloud-Provider durch Fokus auf AI. Diese Spezialisierung ist ein Wettbewerbsvorteil."
  }
};

async function updateMoats() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('Updating moat descriptions to 1-2 sentences each...');
    console.log('='.repeat(80));
    
    let updated = 0;
    
    for (const [ticker, moats] of Object.entries(expandedMoats)) {
      const [result] = await conn.query(
        'UPDATE stocks SET moat1 = ?, moat2 = ?, moat3 = ? WHERE ticker = ?',
        [moats.moat1, moats.moat2, moats.moat3, ticker]
      );
      
      if (result.affectedRows > 0) {
        console.log(`✓ ${ticker.padEnd(15)} - Updated`);
        updated++;
      }
    }
    
    console.log('='.repeat(80));
    console.log(`\nCompleted: ${updated} stocks updated with expanded descriptions`);
    
  } finally {
    await conn.end();
  }
}

updateMoats().catch(console.error);
