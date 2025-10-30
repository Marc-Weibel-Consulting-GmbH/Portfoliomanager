import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TrustpilotWidget from "@/components/trustpilot/TrustpilotWidget";

export default function Reviews() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Kundenbewertungen</h1>
        <p className="text-slate-400">
          Sehen Sie, was unsere Kunden über uns sagen
        </p>
      </div>

      {/* Trustpilot Header Widget */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Unsere Trustpilot-Bewertungen</CardTitle>
        </CardHeader>
        <CardContent>
          <TrustpilotWidget
            templateId="53aa8912dec7e10d38f59f36" // Horizontal widget
            height="140px"
            width="100%"
            theme="dark"
          />
        </CardContent>
      </Card>

      {/* Review Carousel (for later) */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Aktuelle Bewertungen</CardTitle>
        </CardHeader>
        <CardContent>
          <TrustpilotWidget
            templateId="54ad5defc6454f065c28af8b" // Carousel template
            height="240px"
            width="100%"
            theme="dark"
          />
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Trustpilot einrichten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-slate-300">
            <h3 className="font-semibold mb-2">So richten Sie Trustpilot ein:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                Erstellen Sie ein Trustpilot-Konto:{" "}
                <a
                  href="https://businessapp.b2b.trustpilot.com/signup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline"
                >
                  Hier registrieren
                </a>
              </li>
              <li>Verifizieren Sie Ihre Domain</li>
              <li>
                Kopieren Sie Ihre <strong>Business Unit ID</strong> aus dem Trustpilot Dashboard
              </li>
              <li>
                Fügen Sie die Business Unit ID in den{" "}
                <strong>Settings → Secrets</strong> als{" "}
                <code className="bg-slate-700 px-2 py-1 rounded">
                  VITE_TRUSTPILOT_BUSINESS_UNIT_ID
                </code>{" "}
                hinzu
              </li>
              <li>Die Widgets werden automatisch aktualisiert</li>
            </ol>
          </div>

          <div className="bg-slate-700 p-4 rounded-lg">
            <h4 className="font-semibold text-white mb-2">Beispiel Business Unit ID:</h4>
            <code className="text-cyan-400 text-sm">
              5f1234567890abcdef123456
            </code>
            <p className="text-slate-400 text-xs mt-2">
              Die ID finden Sie in Ihrem Trustpilot Dashboard unter "Settings" → "Business Details"
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

