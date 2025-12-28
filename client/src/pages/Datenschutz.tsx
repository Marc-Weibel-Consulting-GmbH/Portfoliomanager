import { APP_LOGO, APP_TITLE } from "@/const";
import { Button } from "@/components/ui/button";

export default function Datenschutz() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Datenschutzerklärung</h1>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Datenschutz auf einen Blick</h2>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Allgemeine Hinweise</h3>
            <p className="text-gray-700 mb-4">
              Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten 
              passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie 
              persönlich identifiziert werden können.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Datenerfassung auf dieser Website</h3>
            <p className="text-gray-700 mb-2 font-semibold">Wer ist verantwortlich für die Datenerfassung auf dieser Website?</p>
            <p className="text-gray-700 mb-4">
              Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten 
              können Sie dem Impressum dieser Website entnehmen.
            </p>

            <p className="text-gray-700 mb-2 font-semibold">Wie erfassen wir Ihre Daten?</p>
            <p className="text-gray-700 mb-4">
              Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich z.B. um 
              Daten handeln, die Sie in ein Kontaktformular eingeben oder bei der Registrierung angeben.
            </p>
            <p className="text-gray-700 mb-4">
              Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere 
              IT-Systeme erfasst. Das sind vor allem technische Daten (z.B. Internetbrowser, Betriebssystem oder 
              Uhrzeit des Seitenaufrufs).
            </p>

            <p className="text-gray-700 mb-2 font-semibold">Wofür nutzen wir Ihre Daten?</p>
            <p className="text-gray-700 mb-4">
              Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website zu gewährleisten. 
              Andere Daten können zur Analyse Ihres Nutzerverhaltens verwendet werden, um unseren Service zu 
              verbessern.
            </p>

            <p className="text-gray-700 mb-2 font-semibold">Welche Rechte haben Sie bezüglich Ihrer Daten?</p>
            <p className="text-gray-700">
              Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer 
              gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung oder 
              Löschung dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, 
              können Sie diese Einwilligung jederzeit für die Zukunft widerrufen.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Hosting</h2>
            <p className="text-gray-700 mb-4">
              Wir hosten die Inhalte unserer Website bei folgendem Anbieter:
            </p>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Externes Hosting</h3>
            <p className="text-gray-700 mb-4">
              Diese Website wird extern gehostet. Die personenbezogenen Daten, die auf dieser Website erfasst werden, 
              werden auf den Servern des Hosters / der Hoster gespeichert. Hierbei kann es sich v.a. um IP-Adressen, 
              Kontaktanfragen, Meta- und Kommunikationsdaten, Vertragsdaten, Kontaktdaten, Namen, Websitezugriffe 
              und sonstige Daten, die über eine Website generiert werden, handeln.
            </p>
            <p className="text-gray-700">
              Das externe Hosting erfolgt zum Zwecke der Vertragserfüllung gegenüber unseren potenziellen und 
              bestehenden Kunden (Art. 6 Abs. 1 lit. b DSGVO) und im Interesse einer sicheren, schnellen und 
              effizienten Bereitstellung unseres Online-Angebots durch einen professionellen Anbieter (Art. 6 Abs. 1 
              lit. f DSGVO).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Allgemeine Hinweise und Pflichtinformationen</h2>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Datenschutz</h3>
            <p className="text-gray-700 mb-4">
              Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre 
              personenbezogenen Daten vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie 
              dieser Datenschutzerklärung.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Hinweis zur verantwortlichen Stelle</h3>
            <p className="text-gray-700 mb-4">
              Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:
            </p>
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="text-gray-700">[Ihr Firmenname]</p>
              <p className="text-gray-700">[Straße und Hausnummer]</p>
              <p className="text-gray-700">[PLZ und Ort]</p>
              <p className="text-gray-700 mt-2">Telefon: [Telefonnummer]</p>
              <p className="text-gray-700">E-Mail: [E-Mail-Adresse]</p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Speicherdauer</h3>
            <p className="text-gray-700 mb-4">
              Soweit innerhalb dieser Datenschutzerklärung keine speziellere Speicherdauer genannt wurde, verbleiben 
              Ihre personenbezogenen Daten bei uns, bis der Zweck für die Datenverarbeitung entfällt. Wenn Sie ein 
              berechtigtes Löschersuchen geltend machen oder eine Einwilligung zur Datenverarbeitung widerrufen, 
              werden Ihre Daten gelöscht, sofern wir keine anderen rechtlich zulässigen Gründe für die Speicherung 
              Ihrer personenbezogenen Daten haben.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Widerruf Ihrer Einwilligung zur Datenverarbeitung</h3>
            <p className="text-gray-700 mb-4">
              Viele Datenverarbeitungsvorgänge sind nur mit Ihrer ausdrücklichen Einwilligung möglich. Sie können eine 
              bereits erteilte Einwilligung jederzeit widerrufen. Die Rechtmäßigkeit der bis zum Widerruf erfolgten 
              Datenverarbeitung bleibt vom Widerruf unberührt.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Recht auf Datenübertragbarkeit</h3>
            <p className="text-gray-700 mb-4">
              Sie haben das Recht, Daten, die wir auf Grundlage Ihrer Einwilligung oder in Erfüllung eines Vertrags 
              automatisiert verarbeiten, an sich oder an einen Dritten in einem gängigen, maschinenlesbaren Format 
              aushändigen zu lassen.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Auskunft, Löschung und Berichtigung</h3>
            <p className="text-gray-700">
              Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit das Recht auf unentgeltliche 
              Auskunft über Ihre gespeicherten personenbezogenen Daten, deren Herkunft und Empfänger und den Zweck 
              der Datenverarbeitung und ggf. ein Recht auf Berichtigung oder Löschung dieser Daten.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Datenerfassung auf dieser Website</h2>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Registrierung auf dieser Website</h3>
            <p className="text-gray-700 mb-4">
              Sie können sich auf dieser Website registrieren, um zusätzliche Funktionen zu nutzen. Die dazu 
              eingegebenen Daten verwenden wir nur zum Zwecke der Nutzung des jeweiligen Angebotes oder Dienstes, 
              für den Sie sich registriert haben. Die bei der Registrierung abgefragten Pflichtangaben müssen 
              vollständig angegeben werden. Anderenfalls werden wir die Registrierung ablehnen.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Kontaktformular</h3>
            <p className="text-gray-700 mb-4">
              Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben aus dem Anfrageformular 
              inklusive der von Ihnen dort angegebenen Kontaktdaten zwecks Bearbeitung der Anfrage und für den Fall 
              von Anschlussfragen bei uns gespeichert.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Anfrage per E-Mail, Telefon oder Telefax</h3>
            <p className="text-gray-700">
              Wenn Sie uns per E-Mail, Telefon oder Telefax kontaktieren, wird Ihre Anfrage inklusive aller daraus 
              hervorgehenden personenbezogenen Daten (Name, Anfrage) zum Zwecke der Bearbeitung Ihres Anliegens bei 
              uns gespeichert und verarbeitet.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Zahlungsanbieter</h2>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Stripe</h3>
            <p className="text-gray-700 mb-4">
              Wir binden den Zahlungsdienstleister Stripe ein. Anbieter ist die Stripe Payments Europe Ltd., 1 Grand 
              Canal Street Lower, Grand Canal Dock, Dublin, Irland (nachfolgend „Stripe").
            </p>
            <p className="text-gray-700 mb-4">
              Wenn Sie die Bezahlung via Stripe auswählen, erfolgt die Zahlungsabwicklung über Stripe. Die 
              Übermittlung Ihrer Daten an Stripe erfolgt auf Grundlage von Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) 
              und Art. 6 Abs. 1 lit. b DSGVO (Verarbeitung zur Erfüllung eines Vertrags).
            </p>
            <p className="text-gray-700">
              Details entnehmen Sie der Datenschutzerklärung von Stripe unter: 
              <a href="https://stripe.com/de/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                https://stripe.com/de/privacy
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Änderung dieser Datenschutzerklärung</h2>
            <p className="text-gray-700">
              Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen rechtlichen 
              Anforderungen entspricht oder um Änderungen unserer Leistungen in der Datenschutzerklärung umzusetzen. 
              Für Ihren erneuten Besuch gilt dann die neue Datenschutzerklärung.
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
