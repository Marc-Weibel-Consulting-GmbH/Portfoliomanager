import { APP_LOGO, APP_TITLE } from "@/const";
import { Button } from "@/components/ui/button";

export default function AGB() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <a href="/" className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
            <span className="text-xl font-bold text-gray-900">{APP_TITLE}</span>
          </a>
          <Button variant="outline" onClick={() => window.location.href = "/"}>
            Zurück zur Startseite
          </Button>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Allgemeine Geschäftsbedingungen (AGB)</h1>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Geltungsbereich</h2>
            <p className="text-gray-700 mb-4">
              Diese Allgemeinen Geschäftsbedingungen (nachfolgend "AGB") gelten für die Nutzung der Plattform 
              {APP_TITLE} (nachfolgend "Plattform") durch registrierte Nutzer (nachfolgend "Nutzer" oder "Sie").
            </p>
            <p className="text-gray-700">
              Betreiber der Plattform ist [Ihr Firmenname], [Adresse] (nachfolgend "wir" oder "Betreiber").
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Vertragsgegenstand</h2>
            <p className="text-gray-700 mb-4">
              Die Plattform bietet Tools zur Portfolio-Analyse, Portfolio-Optimierung und Performance-Tracking von 
              Wertpapier-Portfolios. Der Betreiber stellt dem Nutzer verschiedene Funktionen zur Verfügung, 
              darunter:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
              <li>Portfolio-Optimierung nach Markowitz-Theorie</li>
              <li>Live Performance-Tracking</li>
              <li>Automatisches Dividenden-Tracking</li>
              <li>Transaktionshistorie und Steuer-Reporting</li>
              <li>KI-gestützte Analysen und Empfehlungen</li>
            </ul>
            <p className="text-gray-700">
              Die Plattform dient ausschließlich zu Informations- und Analysezwecken. Es werden keine 
              Anlageberatung oder Vermögensverwaltung angeboten.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Registrierung und Vertragsschluss</h2>
            <p className="text-gray-700 mb-4">
              Die Nutzung der Plattform erfordert eine Registrierung. Mit der Registrierung gibt der Nutzer ein 
              verbindliches Angebot zum Abschluss eines Nutzungsvertrags ab. Der Vertrag kommt mit der Bestätigung 
              der Registrierung durch den Betreiber zustande.
            </p>
            <p className="text-gray-700">
              Der Nutzer verpflichtet sich, bei der Registrierung wahrheitsgemäße und vollständige Angaben zu machen 
              und diese bei Änderungen unverzüglich zu aktualisieren.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Leistungsumfang und Verfügbarkeit</h2>
            <p className="text-gray-700 mb-4">
              Der Betreiber bemüht sich um eine möglichst hohe Verfügbarkeit der Plattform. Eine Verfügbarkeit von 
              100% kann jedoch nicht garantiert werden. Insbesondere Wartungsarbeiten, Weiterentwicklungen oder 
              Störungen können zu vorübergehenden Einschränkungen oder Unterbrechungen führen.
            </p>
            <p className="text-gray-700">
              Der Betreiber behält sich das Recht vor, den Funktionsumfang der Plattform jederzeit zu ändern, zu 
              erweitern oder einzuschränken, sofern dies für den Nutzer zumutbar ist.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Preise und Zahlungsbedingungen</h2>
            <p className="text-gray-700 mb-4">
              Die Plattform bietet verschiedene Tarife an:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
              <li><strong>Free-Tarif:</strong> Kostenlose Nutzung mit eingeschränktem Funktionsumfang</li>
              <li><strong>Premium-Tarif:</strong> CHF 10 pro Monat mit vollem Funktionsumfang</li>
            </ul>
            <p className="text-gray-700 mb-4">
              Die Zahlung erfolgt monatlich im Voraus über den Zahlungsdienstleister Stripe. Der Betreiber behält 
              sich Preisänderungen vor, die dem Nutzer mindestens 30 Tage im Voraus mitgeteilt werden.
            </p>
            <p className="text-gray-700">
              Bei Zahlungsverzug kann der Betreiber den Zugang zur Plattform sperren.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Vertragslaufzeit und Kündigung</h2>
            <p className="text-gray-700 mb-4">
              Der Nutzungsvertrag wird auf unbestimmte Zeit geschlossen. Beide Parteien können den Vertrag jederzeit 
              mit sofortiger Wirkung kündigen.
            </p>
            <p className="text-gray-700 mb-4">
              Die Kündigung kann über die Einstellungen der Plattform oder per E-Mail an [E-Mail-Adresse] erfolgen.
            </p>
            <p className="text-gray-700">
              Bei Kündigung während eines laufenden Abrechnungszeitraums erfolgt keine anteilige Rückerstattung. 
              Der Zugang bleibt bis zum Ende des bezahlten Zeitraums bestehen.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Pflichten des Nutzers</h2>
            <p className="text-gray-700 mb-4">
              Der Nutzer verpflichtet sich:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
              <li>Die Plattform nur für rechtmäßige Zwecke zu nutzen</li>
              <li>Seine Zugangsdaten geheim zu halten und nicht an Dritte weiterzugeben</li>
              <li>Keine Inhalte hochzuladen, die gegen geltendes Recht verstoßen</li>
              <li>Die Plattform nicht zu manipulieren oder zu beschädigen</li>
              <li>Keine automatisierten Zugriffe (Bots, Crawler) ohne Zustimmung durchzuführen</li>
            </ul>
            <p className="text-gray-700">
              Bei Verstoß gegen diese Pflichten kann der Betreiber den Zugang zur Plattform sperren und den Vertrag 
              außerordentlich kündigen.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Haftung und Gewährleistung</h2>
            <p className="text-gray-700 mb-4">
              <strong>Keine Anlageberatung:</strong> Die Plattform dient ausschließlich zu Informations- und 
              Analysezwecken. Alle bereitgestellten Informationen, Analysen und Empfehlungen stellen keine 
              Anlageberatung dar. Der Nutzer trifft alle Anlageentscheidungen eigenverantwortlich.
            </p>
            <p className="text-gray-700 mb-4">
              <strong>Datenqualität:</strong> Der Betreiber bemüht sich um die Bereitstellung korrekter und 
              aktueller Daten. Eine Gewähr für die Richtigkeit, Vollständigkeit und Aktualität der Daten kann 
              jedoch nicht übernommen werden.
            </p>
            <p className="text-gray-700 mb-4">
              <strong>Haftungsbeschränkung:</strong> Der Betreiber haftet nur für Schäden, die auf Vorsatz oder 
              grober Fahrlässigkeit beruhen. Die Haftung für leichte Fahrlässigkeit ist ausgeschlossen, soweit 
              nicht wesentliche Vertragspflichten verletzt werden.
            </p>
            <p className="text-gray-700">
              <strong>Datenverlust:</strong> Der Betreiber empfiehlt dem Nutzer, regelmäßig Sicherungskopien seiner 
              Daten anzufertigen. Eine Haftung für Datenverlust ist ausgeschlossen, soweit dieser nicht auf Vorsatz 
              oder grober Fahrlässigkeit beruht.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Datenschutz</h2>
            <p className="text-gray-700">
              Der Betreiber verarbeitet personenbezogene Daten des Nutzers gemäß den geltenden 
              Datenschutzbestimmungen. Einzelheiten sind in der Datenschutzerklärung geregelt, die unter 
              <a href="/datenschutz" className="text-primary hover:underline ml-1">
                /datenschutz
              </a> abrufbar ist.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Änderungen der AGB</h2>
            <p className="text-gray-700">
              Der Betreiber behält sich das Recht vor, diese AGB jederzeit zu ändern. Änderungen werden dem Nutzer 
              mindestens 30 Tage vor Inkrafttreten per E-Mail mitgeteilt. Widerspricht der Nutzer den Änderungen 
              nicht innerhalb von 30 Tagen, gelten die geänderten AGB als akzeptiert.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Schlussbestimmungen</h2>
            <p className="text-gray-700 mb-4">
              Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
            </p>
            <p className="text-gray-700 mb-4">
              Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der 
              übrigen Bestimmungen davon unberührt.
            </p>
            <p className="text-gray-700">
              Gerichtsstand für alle Streitigkeiten aus diesem Vertrag ist, soweit gesetzlich zulässig, der Sitz 
              des Betreibers.
            </p>
          </section>

          <section className="border-t pt-6">
            <p className="text-sm text-gray-500">
              Stand: Dezember 2025
            </p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Button onClick={() => window.location.href = "/"}>
            Zurück zur Startseite
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">© 2025 {APP_TITLE}. Alle Rechte vorbehalten.</p>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <a href="/datenschutz" className="hover:text-white transition-colors">Datenschutz</a>
            <a href="/agb" className="hover:text-white transition-colors">AGB</a>
            <a href="/impressum" className="hover:text-white transition-colors">Impressum</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
