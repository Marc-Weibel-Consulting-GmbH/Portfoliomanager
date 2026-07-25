import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Camera, CheckCircle, Download, FileText, Loader2, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";

interface PageDefinition {
  label: string;
  path: string;
  scrollable?: boolean;
  subLabel?: string;
}

const PAGES_TO_CAPTURE: PageDefinition[] = [
  // Public
  { label: "Landing Page", path: "/" },
  { label: "Pricing", path: "/pricing" },
  // App
  { label: "Dashboard", path: "/dashboard" },
  { label: "Portfolios – Übersicht", path: "/portfolios" },
  { label: "Markt Hub", path: "/markt" },
  { label: "Aktien – Übersicht", path: "/aktien" },
  { label: "Aktien – Signale", path: "/aktien/signale" },
  { label: "Copilot", path: "/copilot" },
  { label: "Portfolio Builder", path: "/portfolio-builder" },
  { label: "Transaktionen", path: "/transactions" },
  { label: "Dividenden", path: "/dividends" },
  { label: "Preis-Alarme", path: "/price-alerts" },
  { label: "Einstellungen", path: "/einstellungen" },
  { label: "Rechner", path: "/rechner" },
  // Admin
  { label: "Admin – Übersicht", path: "/admin" },
  { label: "Admin – Aktien-Verwaltung", path: "/admin/stocks" },
  { label: "Admin – Watchlist", path: "/admin/watchlist" },
  { label: "Admin – Wikifolio", path: "/admin/wikifolio" },
  { label: "Admin – KPI-Verwaltung", path: "/admin/kpis" },
  { label: "Admin – Secrets", path: "/admin/secrets" },
  { label: "Admin – Berechnungen", path: "/admin/berechnungen" },
  { label: "Admin – Logs", path: "/admin/logs" },
  { label: "Admin – Signal-Performance", path: "/admin/signal-performance" },
  { label: "Admin – Einstellungen", path: "/admin/settings" },
];

interface CaptureResult {
  label: string;
  path: string;
  status: "pending" | "capturing" | "done" | "error";
  images: string[]; // base64 data URLs (one per scroll segment)
  error?: string;
}

async function capturePageInIframe(
  path: string,
  baseUrl: string,
  onProgress?: (msg: string) => void
): Promise<string[]> {
  // We use html2canvas on the current page after navigating via hidden iframe
  // Since cross-origin iframes block canvas, we open a new window instead
  // and use postMessage to coordinate. For same-origin (dev/prod), this works.

  return new Promise((resolve, reject) => {
    const url = `${baseUrl}${path}`;
    const win = window.open(url, "_blank", "width=1440,height=900,scrollbars=yes");
    if (!win) {
      reject(new Error("Popup blockiert – bitte Popups für diese Seite erlauben."));
      return;
    }

    const timeout = setTimeout(() => {
      win.close();
      reject(new Error("Timeout beim Laden der Seite"));
    }, 20000);

    // Poll until the window is loaded
    const checkLoaded = setInterval(async () => {
      try {
        if (win.closed) {
          clearInterval(checkLoaded);
          clearTimeout(timeout);
          reject(new Error("Fenster wurde geschlossen"));
          return;
        }
        // Try to access document – throws if cross-origin
        const doc = win.document;
        if (doc.readyState === "complete") {
          clearInterval(checkLoaded);
          clearTimeout(timeout);

          // Wait a bit for React to render
          await new Promise((r) => setTimeout(r, 2500));

          try {
            const html2canvas = (await import("html2canvas")).default;
            const scrollHeight = win.document.documentElement.scrollHeight;
            const viewHeight = win.innerHeight || 900;
            const segments = Math.ceil(scrollHeight / viewHeight);
            const images: string[] = [];

            for (let i = 0; i < Math.min(segments, 5); i++) {
              win.scrollTo(0, i * viewHeight);
              await new Promise((r) => setTimeout(r, 400));
              const canvas = await html2canvas(win.document.body, {
                useCORS: true,
                allowTaint: true,
                scale: 1.5,
                width: 1440,
                height: viewHeight,
                windowWidth: 1440,
                windowHeight: viewHeight,
                x: 0,
                y: i * viewHeight,
                scrollX: 0,
                scrollY: i * viewHeight,
                logging: false,
              });
              images.push(canvas.toDataURL("image/jpeg", 0.85));
            }

            win.close();
            resolve(images);
          } catch (err) {
            win.close();
            reject(err);
          }
        }
      } catch {
        // Cross-origin or not yet loaded – keep polling
      }
    }, 500);
  });
}

export default function AdminScreenshots() {
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const abortRef = useRef(false);

  const baseUrl = window.location.origin;

  const startCapture = async () => {
    abortRef.current = false;
    setPdfReady(false);
    setPdfUrl(null);
    setIsRunning(true);
    setCurrentIndex(0);

    const initial: CaptureResult[] = PAGES_TO_CAPTURE.map((p) => ({
      label: p.label,
      path: p.path,
      status: "pending",
      images: [],
    }));
    setResults(initial);

    const allImages: { label: string; path: string; images: string[] }[] = [];

    for (let i = 0; i < PAGES_TO_CAPTURE.length; i++) {
      if (abortRef.current) break;
      const page = PAGES_TO_CAPTURE[i];
      setCurrentIndex(i);

      setResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "capturing" } : r))
      );

      try {
        const images = await capturePageInIframe(page.path, baseUrl);
        allImages.push({ label: page.label, path: page.path, images });
        setResults((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "done", images } : r))
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "error", error: msg } : r
          )
        );
        allImages.push({ label: page.label, path: page.path, images: [] });
      }
    }

    // Build PDF
    if (allImages.some((a) => a.images.length > 0)) {
      await buildPdf(allImages);
    }

    setIsRunning(false);
  };

  const buildPdf = async (
    allImages: { label: string; path: string; images: string[] }[]
  ) => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1440, 900] });
    let firstPage = true;

    for (const entry of allImages) {
      if (entry.images.length === 0) continue;
      for (let segIdx = 0; segIdx < entry.images.length; segIdx++) {
        if (!firstPage) pdf.addPage([1440, 900], "landscape");
        firstPage = false;

        // Header bar
        pdf.setFillColor(24, 24, 27); // zinc-900
        pdf.rect(0, 0, 1440, 36, "F");
        pdf.setTextColor(20, 184, 166); // teal-500
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.text(entry.label, 20, 24);
        pdf.setTextColor(161, 161, 170); // zinc-400
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const segLabel =
          entry.images.length > 1 ? ` (Teil ${segIdx + 1}/${entry.images.length})` : "";
        pdf.text(`${entry.path}${segLabel}`, 1420, 24, { align: "right" });

        // Screenshot
        pdf.addImage(entry.images[segIdx], "JPEG", 0, 36, 1440, 864);
      }
    }

    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);
    setPdfReady(true);
  };

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `portfoliomanager-screenshots-${date}.pdf`;
    a.click();
  };

  const done = results.filter((r) => r.status === "done").length;
  const errors = results.filter((r) => r.status === "error").length;
  const progress = results.length > 0 ? Math.round(((done + errors) / results.length) * 100) : 0;

  return (
    <DashboardLayout>
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Screenshots", icon: <Camera className="h-4 w-4" /> },
        ]}
      />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">App-Screenshots</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Erstellt automatisch Screenshots aller Seiten und Unterseiten der App und exportiert
            sie als beschriftetes PDF-Dokument. Jede Seite wird in mehrere Teile aufgeteilt, falls
            sie vertikal scrollbar ist.
          </p>
        </div>

        {/* Info box */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4">
            <div className="flex gap-3 text-sm text-zinc-400">
              <span className="text-amber-400 mt-0.5">⚠</span>
              <div className="space-y-1">
                <p>
                  Für jeden Screenshot wird ein neues Browser-Fenster geöffnet. Bitte{" "}
                  <strong className="text-zinc-200">Popups für diese Seite erlauben</strong> (Browser-Einstellung).
                </p>
                <p>
                  Der Vorgang dauert ca. <strong className="text-zinc-200">2–4 Minuten</strong> für alle {PAGES_TO_CAPTURE.length} Seiten.
                  Nicht-eingeloggte Seiten werden als Login-Seite erfasst.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={startCapture}
            disabled={isRunning}
            className="bg-teal-500 hover:bg-teal-600 text-zinc-900 font-semibold"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Screenshots werden erstellt... ({currentIndex + 1}/{PAGES_TO_CAPTURE.length})
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Screenshots erstellen ({PAGES_TO_CAPTURE.length} Seiten)
              </>
            )}
          </Button>

          {isRunning && (
            <Button
              variant="outline"
              onClick={() => { abortRef.current = true; }}
              className="border-zinc-700 text-zinc-300"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Abbrechen
            </Button>
          )}

          {pdfReady && (
            <Button
              onClick={downloadPdf}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF herunterladen
            </Button>
          )}
        </div>

        {/* Progress */}
        {results.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-teal-400" />
                  Fortschritt
                </CardTitle>
                <div className="flex gap-3 text-sm">
                  <span className="text-emerald-400">{done} ✓</span>
                  {errors > 0 && <span className="text-red-400">{errors} ✗</span>}
                  <span className="text-zinc-500">{results.length} gesamt</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progress} className="h-2" />

              <div className="grid gap-1.5 max-h-96 overflow-y-auto pr-1">
                {results.map((r, i) => (
                  <div
                    key={r.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      r.status === "capturing"
                        ? "bg-teal-500/10 border border-teal-800"
                        : r.status === "done"
                        ? "bg-zinc-800/50"
                        : r.status === "error"
                        ? "bg-red-500/5 border border-red-900"
                        : "bg-zinc-900"
                    }`}
                  >
                    <span className="text-zinc-600 w-6 text-right text-xs">{i + 1}</span>
                    {r.status === "pending" && (
                      <span className="h-4 w-4 rounded-full border border-zinc-700 shrink-0" />
                    )}
                    {r.status === "capturing" && (
                      <Loader2 className="h-4 w-4 text-teal-400 animate-spin shrink-0" />
                    )}
                    {r.status === "done" && (
                      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    )}
                    {r.status === "error" && (
                      <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    <span className={`flex-1 ${r.status === "error" ? "text-red-300" : "text-zinc-300"}`}>
                      {r.label}
                    </span>
                    <span className="text-zinc-600 font-mono text-xs">{r.path}</span>
                    {r.status === "done" && r.images.length > 1 && (
                      <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
                        {r.images.length} Teile
                      </Badge>
                    )}
                    {r.status === "error" && r.error && (
                      <span className="text-red-500 text-xs max-w-48 truncate" title={r.error}>
                        {r.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {pdfReady && (
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-800 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-emerald-300 font-semibold text-sm">PDF bereit!</p>
                    <p className="text-zinc-400 text-xs">
                      {done} Seiten erfasst, {errors} Fehler. Klicke "PDF herunterladen" oben.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Page list preview */}
        {results.length === 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-zinc-100 text-base">Zu erfassende Seiten ({PAGES_TO_CAPTURE.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PAGES_TO_CAPTURE.map((p, i) => (
                  <div key={p.path} className="flex items-center gap-2 text-sm text-zinc-400">
                    <span className="text-zinc-600 w-5 text-right text-xs">{i + 1}</span>
                    <span className="font-mono text-xs text-zinc-500 w-36 truncate">{p.path}</span>
                    <span className="text-zinc-300 truncate">{p.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
