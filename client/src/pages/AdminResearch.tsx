import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { trpc } from "@/lib/trpc";
import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Upload, FileText, Brain, Sparkles, Trash2, RefreshCw, Clock,
  CheckCircle, AlertCircle, Loader2, Send, Bot, Eye, Plus, Key, Download,
  Globe, TrendingUp, TrendingDown, Minus, Database, BookOpen, ExternalLink
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ============================================
// Research-Quellen-Bibliothek (kuratiert)
// ============================================
// Zwei Stufen: (1) kostenlose Quellen mit hohem Mehrwert (direkt nutzbar,
// teils automatisch), (2) institutionelles Sell-Side-Research, dessen
// Vollberichte hinter einer Paywall liegen — dessen Kernaussagen (Kursziele,
// Up-/Downgrades, Investment-Thesen) aber regelmässig in Finanzmedien
// erscheinen und als Zusammenfassung/Exzerpt hochgeladen werden können.
type LibrarySource = {
  tier: "free" | "premium";
  name: string;
  category: string;
  desc: string;
  url: string;
  auto?: boolean;
  use: string;
};

const LIBRARY_SOURCES: LibrarySource[] = [
  // ─── Kostenlos — hoher Mehrwert ───
  {
    tier: "free", name: "Apollo Academy (Torsten Slok)", category: "Makro · kostenlos",
    desc: "Täglich aufbereitete Makro-Charts: Inflation, Arbeitsmarkt, Zinsstruktur, Kreditmärkte, Konsum, AI-Capex, Fiskalpolitik, Private Credit.",
    url: "https://www.apolloacademy.com", auto: false,
    use: "The Daily Spark · Weekly Market Charts · Mid-Year Outlook · Investor Presentations",
  },
  {
    tier: "free", name: "SNB Data Portal", category: "Automatisch (FRED)",
    desc: "CHF-Wechselkurse, Zinsen, Schweizer Renditen, CHF-Risikozinssatz.",
    url: "https://data.snb.ch", auto: true,
    use: "FX-Kalkulation, DCF, Sharpe-Ratio, CHF-Portfolios",
  },
  {
    tier: "free", name: "FRED / St. Louis Fed", category: "Automatisch",
    desc: "Makro-, Zins-, Inflations-, Spread- und Rezessionsdaten.",
    url: "https://fred.stlouisfed.org", auto: true,
    use: "Regime-Indikatoren, Zinskurve, Credit Spreads",
  },
  {
    tier: "free", name: "Federal Reserve", category: "Manueller Upload",
    desc: "FOMC-Statements, Summary of Economic Projections (SEP), H.8 Bankbilanzen, Flow of Funds (Z.1).",
    url: "https://www.federalreserve.gov/data.htm", auto: false,
    use: "Geldpolitik-Regime, Liquidität, Kreditwachstum",
  },
  {
    tier: "free", name: "Kenneth French Data Library", category: "Manueller Upload",
    desc: "Faktor-Renditen: Value, Size, Momentum, Profitability, Investment.",
    url: "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html", auto: false,
    use: "Faktorprämien, Backtest, Smart Beta",
  },
  {
    tier: "free", name: "OECD Data", category: "Manueller Upload",
    desc: "Leading Indicators (CLI), BIP, Inflation, Arbeitsmarkt — international vergleichbar.",
    url: "https://data.oecd.org", auto: false,
    use: "Globales Konjunkturregime, Frühindikatoren",
  },
  {
    tier: "free", name: "IMF Data", category: "Manueller Upload",
    desc: "World Economic Outlook, Global Financial Stability Report, Länderdaten.",
    url: "https://www.imf.org/en/Data", auto: false,
    use: "Wachstums-/Risikoausblick, Länder-/Regionenallokation",
  },
  {
    tier: "free", name: "BIS Data Portal", category: "Manueller Upload",
    desc: "Kreditzyklen, Debt Service Ratios, globale Liquidität, Property Prices.",
    url: "https://data.bis.org", auto: false,
    use: "Systemisches Risiko, Kreditblase-Frühindikatoren",
  },
  {
    tier: "free", name: "SEC EDGAR", category: "Automatisch (/edgar)",
    desc: "Offizielle US-Unternehmensberichte: 10-K, 10-Q, 8-K, XBRL-Fundamentaldaten.",
    url: "https://www.sec.gov/cgi-bin/browse-edgar", auto: true,
    use: "Fundamentalanalyse US-Aktien, Bilanzprüfung",
  },
  {
    tier: "free", name: "Aswath Damodaran Data", category: "Manueller Upload",
    desc: "Equity Risk Premiums, WACC, Country Risk Premiums, Branchen-Multiples.",
    url: "https://pages.stern.nyu.edu/~adamodar/", auto: false,
    use: "Bewertungsannahmen, DCF-Modelle, Länderrisiko",
  },
  {
    tier: "free", name: "Research Affiliates (RAFI)", category: "Manueller Upload",
    desc: "Langfristige erwartete Renditen nach Anlageklasse und Region (10J).",
    url: "https://www.researchaffiliates.com/asset-allocation-interactive", auto: false,
    use: "Strategische Asset-Allokation, 10J-Erwartungen",
  },
  {
    tier: "free", name: "J.P. Morgan Guide to the Markets", category: "Manueller Upload",
    desc: "Marktgrafiken, Makro-Zyklen, Bewertungen, Zinsen, Aktien/Bonds.",
    url: "https://am.jpmorgan.com/us/en/asset-management/adv/insights/market-insights/guide-to-the-markets/", auto: false,
    use: "Marktregime-Kontext, Bewertungsniveaus, Zyklusanalyse",
  },
  {
    tier: "free", name: "Unternehmenspräsentationen (IR)", category: "Manueller Upload",
    desc: "Investor Presentations, Quartals-Decks und Geschäftsberichte direkt von den Unternehmen.",
    url: "https://www.annualreports.com", auto: false,
    use: "Fundamentaldaten, Guidance, Segmentanalyse",
  },
  // ─── Institutionelles Premium-Research (Kernaussagen via Finanzmedien) ───
  {
    tier: "premium", name: "Bernstein Research", category: "Premium · via Medien",
    desc: "Klassisches Sell-Side-Research. Vollberichte/Modelle nur für Kunden — Kernaussagen via Bloomberg/Reuters/CNBC.",
    url: "https://www.bernsteinresearch.com", auto: false,
    use: "Kursziel-Änderungen, Up-/Downgrades, Investment-Thesen",
  },
  {
    tier: "premium", name: "Goldman Sachs Research", category: "Premium · via Medien",
    desc: "Makro- und Branchen-Research; öffentlich meist nur Insights-Artikel und Medienzitate.",
    url: "https://www.goldmansachs.com/insights", auto: false,
    use: "Makro-Ausblick, Sektor-Calls, Top-Ideen (Medienecho)",
  },
  {
    tier: "premium", name: "Morgan Stanley Research", category: "Premium · via Medien",
    desc: "Strategie- und Unternehmens-Research; öffentlich Ideas-Artikel und Zitate.",
    url: "https://www.morganstanley.com/ideas", auto: false,
    use: "Strategie-Thesen, Kursziele, Sektor-Präferenzen",
  },
  {
    tier: "premium", name: "BofA Global Research", category: "Premium · via Medien",
    desc: "Fund Manager Survey, Flow Show, Sektor-Research; Kernaussagen breit in Medien zitiert.",
    url: "https://institute.bankofamerica.com", auto: false,
    use: "Positionierung/Sentiment, Flows, Makro-Ausblick",
  },
  {
    tier: "premium", name: "UBS Research", category: "Premium · via Medien",
    desc: "CIO-Ausblick und House View öffentlich; Detail-Research für Kunden.",
    url: "https://www.ubs.com/global/en/wealth-management/insights.html", auto: false,
    use: "House View, Asset-Allokation, CHF-/Europa-Sicht",
  },
  {
    tier: "premium", name: "Evercore ISI", category: "Premium · via Medien",
    desc: "Makro-/Strategie-Research (Ed Hyman); Kernaussagen in Finanzmedien.",
    url: "https://www.evercoreisi.com", auto: false,
    use: "Makro-Regime, Fed-Pfad, Rezessionswahrscheinlichkeit",
  },
  {
    tier: "premium", name: "Wolfe Research", category: "Premium · via Medien",
    desc: "Quant-/Portfolio-Strategie und Sektor-Research; überwiegend Kunden-exklusiv.",
    url: "https://www.wolferesearch.com", auto: false,
    use: "Faktor-/Quant-Signale, Sektor-Rotation",
  },
  {
    tier: "premium", name: "Redburn Atlantic", category: "Premium · via Medien",
    desc: "Europäisches/US-Unternehmens-Research; Kernaussagen teils in Medien.",
    url: "https://www.redburnatlantic.com", auto: false,
    use: "Europa-Unternehmens-Calls, Kursziele",
  },
  {
    tier: "premium", name: "Autonomous Research", category: "Premium · via Medien",
    desc: "Spezialist für Financials (Banken/Versicherer); Kunden-exklusiv, Zitate in Medien.",
    url: "https://www.autonomous.com", auto: false,
    use: "Financials-Sektor, Banken-/Versicherer-Thesen",
  },
];

function SourceCard({ src, onUpload }: { src: LibrarySource; onUpload: (name: string) => void }) {
  return (
    <div className="border border-white/10 rounded-lg p-4 bg-[#0f1420] hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-medium text-sm text-white">{src.name}</span>
        <Badge
          variant={src.auto ? "default" : "outline"}
          className={`text-[10px] shrink-0 ${
            src.auto
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              : src.tier === "premium"
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
              : "text-gray-400"
          }`}
        >
          {src.category}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{src.desc}</p>
      <p className="text-xs text-[#00CFC1]/70 mb-3">→ {src.use}</p>
      <div className="flex items-center gap-2">
        <a
          href={src.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#00CFC1] hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Quelle öffnen
        </a>
        {!src.auto && (
          <button
            onClick={() => onUpload(src.name)}
            className="text-xs text-[#00CFC1] hover:underline flex items-center gap-1 ml-1"
          >
            <Upload className="h-3 w-3" />
            {src.tier === "premium" ? "Zusammenfassung hochladen" : "PDF hochladen"}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Research Documents Tab
// ============================================
function ResearchDocumentsTab() {
  const { data: documents, isLoading, refetch } = trpc.researchAdmin.listDocuments.useQuery(
    undefined,
    {
      // Poll every 4 seconds when any document is still processing
      refetchInterval: (data) => {
        const docs = data?.state?.data as any[] | undefined;
        const hasProcessing = docs?.some((d: any) =>
          d.status === "extracting" || d.status === "analyzing" || d.status === "uploading"
        );
        return hasProcessing ? 4000 : false;
      },
    }
  );
  const uploadMutation = trpc.researchAdmin.uploadDocument.useMutation();
  const deleteMutation = trpc.researchAdmin.deleteDocument.useMutation();
  const reanalyzeMutation = trpc.researchAdmin.reanalyzeDocument.useMutation();
  
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewDoc, setViewDoc] = useState<any>(null);
  // U-08: Löschbestätigung über AlertDialog statt Browser-confirm()
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      toast.error("Bitte Titel und Datei angeben");
      return;
    }
    setUploading(true);
    try {
      // Convert file to base64
      const buffer = await selectedFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      
      await uploadMutation.mutateAsync({
        title: title.trim(),
        filename: selectedFile.name,
        fileBase64: base64,
      });
      
      toast.success("Dokument hochgeladen – Analyse läuft...");
      setUploadOpen(false);
      setTitle("");
      setSelectedFile(null);
      refetch();
    } catch (e: any) {
      toast.error(`Upload fehlgeschlagen: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Dokument gelöscht");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleReanalyze = async (id: number) => {
    try {
      await reanalyzeMutation.mutateAsync({ id });
      toast.success("Erneute Analyse gestartet...");
      setTimeout(() => refetch(), 3000);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready": return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Analysiert</Badge>;
      case "analyzing": return <Badge className="bg-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />KI-Analyse läuft...</Badge>;
      case "extracting": return <Badge className="bg-yellow-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Text wird extrahiert...</Badge>;
      case "uploading": return <Badge className="bg-orange-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Wird hochgeladen...</Badge>;
      case "error": return <Badge className="bg-red-600"><AlertCircle className="h-3 w-3 mr-1" />Fehler</Badge>;
      default: return <Badge className="bg-gray-600"><Clock className="h-3 w-3 mr-1" />Warten</Badge>;
    }
  };

  const getProgressBar = (status: string) => {
    const steps = ["uploading", "extracting", "analyzing", "ready"];
    const idx = steps.indexOf(status);
    if (idx < 0 || status === "ready" || status === "error") return null;
    const pct = Math.round(((idx + 1) / 4) * 100);
    const labels: Record<string, string> = {
      uploading: "1/3 – Datei wird hochgeladen...",
      extracting: "2/3 – Text wird extrahiert (kann bei grossen PDFs 30-60s dauern)...",
      analyzing: "3/3 – KI analysiert Inhalt...",
    };
    return (
      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{labels[status] || status}</span>
          <span className="text-xs text-[#00CFC1]">{pct}%</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5">
          <div
            className="bg-[#00CFC1] h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  const getFileIcon = (fileType: string) => {
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Research-Dokumente</h2>
          <p className="text-sm text-muted-foreground">
            Hochgeladene Dokumente werden analysiert und fliessen in alle KI-Empfehlungen ein.
          </p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="h-4 w-4 mr-2" />Dokument hochladen</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Research-Dokument hochladen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Titel</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z.B. FCO Report Juni 2026"
                />
              </div>
              <div>
                <Label>Datei (PDF, Word, PPT, Excel)</Label>
                <div
                  className="mt-2 border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center cursor-pointer hover:border-[#00CFC1] transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files[0];
                    if (file) setSelectedFile(file);
                  }}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-5 w-5 text-[#00CFC1]" />
                      <span className="text-sm">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Datei hier ablegen oder klicken</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, PPTX, XLSX (max 20 MB)</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedFile(file);
                  }}
                />
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !title.trim()}
                className="w-full"
              >
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? "Wird hochgeladen..." : "Hochladen & Analysieren"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !documents?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Noch keine Dokumente hochgeladen</p>
            <p className="text-sm text-muted-foreground mt-1">
              Laden Sie Research-Reports, Analysen oder Marktberichte hoch.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc: any) => (
            <Card key={doc.id} className="hover:border-zinc-600 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getFileIcon(doc.fileType)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{doc.title}</h3>
                        {getStatusBadge(doc.status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {doc.filename} • {doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(1)} MB` : ""} • {new Date(doc.uploadedAt).toLocaleDateString("de-CH")}
                      </p>
                      {doc.status === "ready" && doc.summary && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{doc.summary}</p>
                      )}
                      {doc.status === "ready" && doc.relevantTickers && (doc.relevantTickers as string[]).length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {(doc.relevantTickers as string[]).slice(0, 8).map((t: string) => (
                            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      )}
                      {doc.status === "error" && doc.errorMessage && (
                        <p className="text-sm text-red-400 mt-2">{doc.errorMessage}</p>
                      )}
                      {(doc.status === "extracting" || doc.status === "analyzing" || doc.status === "uploading") && getProgressBar(doc.status)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {doc.status === "ready" && (
                      <Button variant="ghost" size="sm" onClick={() => setViewDoc(doc)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleReanalyze(doc.id)}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeletingDocId(doc.id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Document Detail Dialog */}
      <Dialog open={!!viewDoc} onOpenChange={() => setViewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#00CFC1]" />
              {viewDoc?.title}
            </DialogTitle>
            {viewDoc && (
              <p className="text-xs text-muted-foreground">
                {viewDoc.filename} • Analysiert am {viewDoc.analyzedAt ? new Date(viewDoc.analyzedAt).toLocaleString("de-CH") : "–"}
              </p>
            )}
          </DialogHeader>
          {viewDoc && (
            <div className="space-y-5 pt-2">
              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                <h4 className="font-semibold text-sm text-[#00CFC1] mb-3 flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Zusammenfassung
                </h4>
                <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {viewDoc.summary}
                </div>
              </div>
              {viewDoc.keyInsights && (viewDoc.keyInsights as string[]).length > 0 && (
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <h4 className="font-semibold text-sm text-[#00CFC1] mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Schlüsselerkenntnisse ({(viewDoc.keyInsights as string[]).length})
                  </h4>
                  <ul className="space-y-2">
                    {(viewDoc.keyInsights as string[]).map((insight: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-[#00CFC1] font-bold text-xs mt-0.5 shrink-0">{i+1}.</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {viewDoc.relevantTickers && (viewDoc.relevantTickers as string[]).length > 0 && (
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <h4 className="font-semibold text-sm text-[#00CFC1] mb-3">Erwähnte Aktien & Ticker</h4>
                  <div className="flex gap-1 flex-wrap">
                    {(viewDoc.relevantTickers as string[]).map((t: string) => (
                      <Badge key={t} variant="outline" className="font-mono">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
                <h4 className="font-semibold text-sm text-amber-400 mb-2 flex items-center gap-2">
                  ⚡ KI-Kontext-Integration
                </h4>
                <p className="text-xs text-muted-foreground">
                  Diese Erkenntnisse werden automatisch in alle KI-Empfehlungen injiziert: <strong>Copilot</strong>, <strong>AI Insights</strong> und <strong>Multi-Agent</strong>. Der Kontext wird bei jedem LLM-Aufruf als zusätzlicher System-Prompt mitgeschickt.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Löschbestätigung (U-08) */}
      <ConfirmDialog
        open={deletingDocId !== null}
        onOpenChange={(open) => { if (!open) setDeletingDocId(null); }}
        title="Dokument löschen?"
        description="Das Research-Dokument und seine KI-Analyse werden dauerhaft gelöscht."
        confirmLabel="Dokument löschen"
        onConfirm={() => { if (deletingDocId !== null) handleDelete(deletingDocId); }}
        isPending={deleteMutation.isPending}
      />

      {/* KI-Kontext Transparenz Panel */}
      <ResearchContextPanel />
    </div>
  );
}

// ============================================
// Research Context Transparency Panel
// ============================================
function ResearchContextPanel() {
  const { data: ctx, isLoading } = trpc.researchAdmin.getResearchContext.useQuery();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return null;
  if (!ctx || ctx.documentCount === 0) return null;

  return (
    <div className="mt-6">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-amber-400" />
              <CardTitle className="text-base text-amber-400">KI-Kontext aktiv</CardTitle>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                {ctx.documentCount} {ctx.documentCount === 1 ? "Dokument" : "Dokumente"}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-xs text-muted-foreground">
              {expanded ? "Weniger" : "Kontext anzeigen"}
            </Button>
          </div>
          <CardDescription className="text-xs">
            Diese Research-Erkenntnisse werden automatisch in Copilot, AI Insights und Multi-Agent injiziert.
            {ctx.tickers.length > 0 && (
              <span className="ml-1">Relevante Ticker: <strong>{ctx.tickers.slice(0, 10).join(", ")}</strong>{ctx.tickers.length > 10 ? ` +${ctx.tickers.length - 10} weitere` : ""}</span>
            )}
          </CardDescription>
        </CardHeader>
        {expanded && (
          <CardContent className="pt-0">
            <div className="space-y-2 mb-3">
              {ctx.documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between text-xs bg-zinc-900 rounded px-3 py-2">
                  <span className="font-medium truncate flex-1">{doc.title}</span>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-muted-foreground">{doc.insightCount} Erkenntnisse</span>
                    {doc.tickers.length > 0 && (
                      <div className="flex gap-1">
                        {doc.tickers.slice(0, 3).map((t: string) => (
                          <Badge key={t} variant="outline" className="text-xs py-0 h-4 font-mono">{t}</Badge>
                        ))}
                        {doc.tickers.length > 3 && <span className="text-muted-foreground">+{doc.tickers.length - 3}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Exakter LLM-Kontext (wird bei jedem KI-Aufruf mitgeschickt):</p>
              <pre className="text-xs bg-zinc-950 rounded p-3 overflow-x-auto text-zinc-400 whitespace-pre-wrap border border-zinc-800 max-h-48 overflow-y-auto">
                {ctx.contextPreview}
              </pre>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ============================================
// Makro-Quellen Tab
// ============================================
function MacroSourcesTab() {
  const { data: indicators, isLoading, refetch } = trpc.macroSources.list.useQuery();
  const apolloFeed = trpc.macroSources.getApolloFeed.useQuery(undefined, { staleTime: 30 * 60 * 1000 });
  const fetchFredMutation = trpc.macroSources.fetchFred.useMutation();
  const fetchWbMutation = trpc.macroSources.fetchWorldBank.useMutation();
  const [fetchingFred, setFetchingFred] = useState(false);
  const [fetchingWb, setFetchingWb] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<any | null>(null);

  // Upload-Dialog für Bibliothek-Karten
  const uploadMutation = trpc.researchAdmin.uploadDocument.useMutation();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) { toast.error("Bitte Titel und Datei angeben"); return; }
    setUploading(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ""));
      await uploadMutation.mutateAsync({ title: title.trim(), filename: selectedFile.name, fileBase64: base64 });
      toast.success("Dokument hochgeladen – Analyse läuft...");
      setUploadOpen(false); setTitle(""); setSelectedFile(null);
    } catch (e: any) { toast.error(`Upload fehlgeschlagen: ${e.message}`); }
    finally { setUploading(false); }
  };

  const handleFetchFred = async () => {
    setFetchingFred(true);
    try {
      const result = await fetchFredMutation.mutateAsync();
      toast.success(`FRED: ${result.successCount}/${result.totalCount} Serien erfolgreich abgerufen`);
      refetch();
    } catch (err: any) {
      toast.error("FRED-Fetch fehlgeschlagen: " + err.message);
    } finally {
      setFetchingFred(false);
    }
  };

  const handleFetchWb = async () => {
    setFetchingWb(true);
    try {
      const result = await fetchWbMutation.mutateAsync();
      toast.success(`World Bank: ${result.successCount}/${result.results.length} Serien abgerufen`);
      refetch();
    } catch (err: any) {
      toast.error("World Bank-Fetch fehlgeschlagen: " + err.message);
    } finally {
      setFetchingWb(false);
    }
  };

  const CATEGORY_LABELS: Record<string, string> = {
    yield_curve: "Zinskurve",
    inflation: "Inflation",
    rates: "Zinsen",
    employment: "Arbeitsmarkt",
    credit: "Kreditmarkt",
    fx: "Währungen",
    gdp: "BIP-Wachstum",
  };

  const grouped = (indicators ?? []).reduce((acc: Record<string, any[]>, ind) => {
    const cat = ind.category ?? "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ind);
    return acc;
  }, {});

  const getDeltaIcon = (latest: number | null, previous: number | null) => {
    if (latest === null || previous === null) return <Minus className="h-3 w-3 text-gray-500" />;
    if (latest > previous) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
    if (latest < previous) return <TrendingDown className="h-3 w-3 text-red-400" />;
    return <Minus className="h-3 w-3 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header mit Fetch-Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Makro-Indikatoren</h2>
          <p className="text-sm text-muted-foreground">
            Automatisch abgerufene Daten von FRED (St. Louis Fed) und World Bank.
            Fliessen in Marktregime-Analyse und KI-Empfehlungen ein.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleFetchFred}
            disabled={fetchingFred}
            className="gap-2"
          >
            {fetchingFred ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            FRED abrufen (12 Serien)
          </Button>
          <Button
            variant="outline"
            onClick={handleFetchWb}
            disabled={fetchingWb}
            className="gap-2"
          >
            {fetchingWb ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            World Bank (BIP)
          </Button>
        </div>
      </div>

      {/* Quellen-Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { name: "FRED / St. Louis Fed", desc: "Zinsen, Inflation, Arbeitsmarkt, Credit Spreads, FX", url: "https://fred.stlouisfed.org", count: indicators?.filter(i => i.source === "FRED").length ?? 0 },
          { name: "World Bank", desc: "BIP-Wachstum CH, US, EU, DE (jährlich)", url: "https://data.worldbank.org", count: indicators?.filter(i => i.source === "WORLDBANK").length ?? 0 },
          { name: "Manueller Upload", desc: "J.P. Morgan Guide, Damodaran, ARK Invest, Beth Kindig (PDF)", url: null, count: null },
        ].map((src) => (
          <div key={src.name} className="border border-white/10 rounded-lg p-3 bg-[#0f1420]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">{src.name}</span>
              {src.count !== null && (
                <Badge variant="outline" className="text-xs">{src.count} Serien</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{src.desc}</p>
            {src.url && (
              <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00CFC1] hover:underline mt-1 inline-block">
                {src.url} ↗
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Indikatoren nach Kategorie */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Lade Indikatoren...</span>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-lg">
          <Database className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Noch keine Daten vorhanden.</p>
          <p className="text-sm text-muted-foreground mt-1">Klicken Sie auf "FRED abrufen" um die ersten Daten zu laden.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {CATEGORY_LABELS[cat] ?? cat}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((ind: any) => {
                const delta = ind.latestValue !== null && ind.previousValue !== null
                  ? ind.latestValue - ind.previousValue : null;
                const isNegative = ind.latestValue !== null && ind.latestValue < 0;
                return (
                  <div
                    key={ind.seriesKey}
                    className="border border-white/10 rounded-lg p-3 bg-[#0f1420] cursor-pointer hover:border-[#00CFC1]/40 transition-colors"
                    onClick={() => setSelectedSeries(selectedSeries?.seriesKey === ind.seriesKey ? null : ind)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-medium leading-tight">{ind.label}</span>
                      <span className={`text-sm font-mono font-bold shrink-0 ${
                        isNegative ? "text-red-400" : "text-emerald-400"
                      }`}>
                        {ind.latestValue !== null ? ind.latestValue.toFixed(2) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{ind.latestDate ?? "—"}</span>
                      <div className="flex items-center gap-1">
                        {getDeltaIcon(ind.latestValue, ind.previousValue)}
                        {delta !== null && (
                          <span className={`text-xs font-mono ${
                            delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-gray-500"
                          }`}>
                            {delta > 0 ? "+" : ""}{delta.toFixed(3)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Mini-Chart wenn ausgewählt */}
                    {selectedSeries?.seriesKey === ind.seriesKey && Array.isArray(ind.timeseries) && ind.timeseries.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div style={{ height: 120 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={ind.timeseries.slice(-180)} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.slice(0, 7)} interval={Math.floor(ind.timeseries.length / 5)} />
                              <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                              <Tooltip
                                contentStyle={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }}
                                formatter={(v: any) => [Number(v).toFixed(3), ind.label]}
                              />
                              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                              <Line
                                type="monotone"
                                dataKey="value"
                                stroke={isNegative ? "#f87171" : "#00CFC1"}
                                dot={false}
                                strokeWidth={1.5}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        {ind.interpretation && (
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{ind.interpretation}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* ===== Apollo Research-Feed (Torsten Slok) ===== */}
      <div className="mt-8">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#00CFC1]" />
            <h2 className="text-lg font-semibold">Apollo Research-Feed (Torsten Slok)</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => apolloFeed.refetch()}
            disabled={apolloFeed.isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${apolloFeed.isFetching ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Automatisch aus den öffentlichen Apollo-Academy-RSS-Feeds (Daily Spark + Outlooks) —
          Titel, Datum und Kurz-Exzerpt mit Rückverweis auf die Originalquelle.
        </p>

        {apolloFeed.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Feed wird geladen …
          </div>
        ) : apolloFeed.isError || (apolloFeed.data && apolloFeed.data.items.length === 0) ? (
          <div className="flex items-start gap-2 text-sm text-amber-300 border border-amber-500/30 bg-amber-500/5 rounded-lg p-4">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              Apollo-Feed derzeit nicht abrufbar. Quelle direkt öffnen:{" "}
              <a href="https://www.apolloacademy.com/the-daily-spark/" target="_blank" rel="noopener noreferrer" className="text-[#00CFC1] hover:underline">apolloacademy.com</a>.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {apolloFeed.data?.items.map((item) => (
              <a
                key={item.link}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-white/10 rounded-lg p-4 bg-[#0f1420] hover:border-[#00CFC1]/40 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${item.feed === "daily-spark" ? "bg-[#00CFC1]/10 text-[#00CFC1] border-[#00CFC1]/30" : "text-gray-400"}`}
                  >
                    {item.feed === "daily-spark" ? "Daily Spark" : "Outlook / View"}
                  </Badge>
                  {item.publishedAt && (
                    <span className="text-[11px] text-gray-500 font-mono shrink-0">{item.publishedAt}</span>
                  )}
                </div>
                <h3 className="text-sm font-medium text-white group-hover:text-[#00CFC1] transition-colors mb-1.5 flex items-start gap-1">
                  <span className="flex-1">{item.title}</span>
                  <ExternalLink className="h-3 w-3 mt-1 shrink-0 text-gray-600 group-hover:text-[#00CFC1]" />
                </h3>
                {item.excerpt && <p className="text-xs text-muted-foreground line-clamp-3">{item.excerpt}</p>}
                {item.categories.length > 0 && (
                  <p className="text-[10px] text-gray-600 mt-2 truncate">{item.categories.join(" · ")}</p>
                )}
              </a>
            ))}
          </div>
        )}
        {apolloFeed.data?.fetchedAt && (
          <p className="text-[11px] text-gray-600 mt-3">
            Zuletzt abgerufen: {new Date(apolloFeed.data.fetchedAt).toLocaleString("de-CH")} ·
            Quelle: apolloacademy.com (RSS)
          </p>
        )}
      </div>

      {/* ===== Research-Quellen-Bibliothek ===== */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-[#00CFC1]" />
          <h2 className="text-lg font-semibold">Research-Quellen-Bibliothek</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Kuratierte Quellen für strategische Allokation, Faktorqualität und Risikobewertung.
          Automatische Quellen fliessen laufend ein; bei den übrigen können PDFs bzw.
          Zusammenfassungen hochgeladen werden und gehen in die KI-Empfehlungen ein.
        </p>

        {/* Kontext: was ist öffentlich? (Apollo vs. Sell-Side) */}
        <div className="mb-5 rounded-lg border border-white/10 bg-[#0f1420] p-4 text-xs text-gray-400 leading-relaxed">
          <span className="text-gray-300 font-medium">Zur Einordnung: </span>
          Kostenlose Makro-Quellen wie <span className="text-white">Apollo (Torsten Slok)</span> liefern
          täglich aufbereitete Charts und Outlooks in institutioneller Qualität. Klassisches
          <span className="text-white"> Sell-Side-Research</span> (Bernstein, Goldman, Morgan Stanley …)
          ist dagegen überwiegend Kunden-exklusiv — Vollberichte, Bewertungs- und Earnings-Modelle
          sind nicht öffentlich. Deren <span className="text-white">Kernaussagen</span> (Kursziel-Änderungen,
          Up-/Downgrades, Investment-Thesen) erscheinen jedoch regelmässig in Finanzmedien und lassen
          sich als Zusammenfassung erfassen.
        </div>

        {/* Stufe 1: kostenlos */}
        <div className="flex items-center gap-2 mb-3">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Kostenlos — hoher Mehrwert</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {LIBRARY_SOURCES.filter((s) => s.tier === "free").map((src) => (
            <SourceCard key={src.name} src={src} onUpload={(name) => { setTitle(name); setUploadOpen(true); }} />
          ))}
        </div>

        {/* Stufe 2: Premium (via Medien) */}
        <div className="flex items-center gap-2 mb-3">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Institutionelles Premium-Research</h3>
          <span className="text-[11px] text-gray-500">— Kernaussagen via Finanzmedien</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {LIBRARY_SOURCES.filter((s) => s.tier === "premium").map((src) => (
            <SourceCard key={src.name} src={src} onUpload={(name) => { setTitle(name); setUploadOpen(true); }} />
          ))}
        </div>
      </div>

      {/* Upload-Dialog für Bibliothek-Karten */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Research-Dokument hochladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Titel</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Damodaran ERP 2025" />
            </div>
            <div>
              <Label>Datei (PDF, Word, PPT, Excel)</Label>
              <div
                className="mt-2 border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center cursor-pointer hover:border-[#00CFC1] transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) setSelectedFile(f); }}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-[#00CFC1]" />
                    <span className="text-sm">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Datei hier ablegen oder klicken</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, PPTX, XLSX (max 20 MB)</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
            </div>
            <Button onClick={handleUpload} disabled={uploading || !selectedFile || !title.trim()} className="w-full">
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? "Wird hochgeladen..." : "Hochladen & Analysieren"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Multi-Agent Tab
// ============================================
function MultiAgentTab() {
  const { data: sessions, isLoading, refetch } = trpc.researchAdmin.listSessions.useQuery();
  const runMutation = trpc.researchAdmin.runMultiAgent.useMutation();
  const deleteMutation = trpc.researchAdmin.deleteSession.useMutation();
  
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [providers, setProviders] = useState<string[]>(["manus", "anthropic", "perplexity"]);
  const [running, setRunning] = useState(false);
  const [viewSession, setViewSession] = useState<any>(null);
  // U-08: Löschbestätigung über AlertDialog statt Browser-confirm()
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);
  const [expandedResponse, setExpandedResponse] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [generatingPresentation, setGeneratingPresentation] = useState(false);
  const [presentationHtml, setPresentationHtml] = useState<string | null>(null);
  const exportMutation = trpc.researchAdmin.exportSession.useMutation();
  const presentationMutation = trpc.researchAdmin.generatePresentation.useMutation();

  const handleExport = async (sessionId: number) => {
    setExporting(true);
    try {
      const result = await exportMutation.mutateAsync({ id: sessionId, format: "pptx" });
      const a = document.createElement("a");
      a.href = result.url;
      a.download = result.filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Präsentation wird heruntergeladen...");
    } catch (e: any) {
      toast.error(`Export fehlgeschlagen: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleGeneratePresentation = async (sessionId: number) => {
    setGeneratingPresentation(true);
    setPresentationHtml(null);
    try {
      const result = await presentationMutation.mutateAsync({ id: sessionId });
      // Close the dialog first, then open in new tab
      setViewSession(null);
      const blob = new Blob([result.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) {
        win.focus();
        // Revoke after 60s
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        // Fallback: store in state for inline display
        setPresentationHtml(result.html);
      }
      toast.success("Präsentation in neuem Tab geöffnet!");
    } catch (e: any) {
      toast.error(`Präsentation fehlgeschlagen: ${e.message}`);
    } finally {
      setGeneratingPresentation(false);
    }
  };

  const handleRun = async () => {
    if (!prompt.trim()) {
      toast.error("Bitte einen Prompt eingeben");
      return;
    }
    setRunning(true);
    try {
      await runMutation.mutateAsync({
        prompt: prompt.trim(),
        context: context.trim() || undefined,
        providers: providers as any,
      });
      toast.success("Multi-Agent-Analyse gestartet...");
      setPrompt("");
      setContext("");
      // Poll for results
      setTimeout(() => refetch(), 5000);
      setTimeout(() => refetch(), 15000);
      setTimeout(() => refetch(), 30000);
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Session gelöscht");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingSessionId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Abgeschlossen</Badge>;
      case "running": return <Badge className="bg-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Läuft...</Badge>;
      case "synthesizing": return <Badge className="bg-purple-600"><Brain className="h-3 w-3 mr-1 animate-spin" />Synthese...</Badge>;
      case "error": return <Badge className="bg-red-600"><AlertCircle className="h-3 w-3 mr-1" />Fehler</Badge>;
      default: return <Badge className="bg-gray-600"><Clock className="h-3 w-3 mr-1" />Warten</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Prompt Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-[#00CFC1]" />
            Multi-Agent Prompt
          </CardTitle>
          <CardDescription>
            Stellen Sie eine Frage – drei KI-Modelle (Manus, Anthropic Claude, Perplexity) antworten parallel und ein Supervisor konsolidiert die Ergebnisse.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Prompt / Frage</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="z.B. Analysiere die aktuelle Bewertung von Nestlé (NESN.SW) im Vergleich zu Unilever und Danone. Welche Aktie bietet das beste Risiko-Rendite-Verhältnis?"
              rows={4}
            />
          </div>
          <div>
            <Label>Kontext (optional)</Label>
            <Input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="z.B. Portfolio enthält bereits 8% NESN.SW, Anlagehorizont 5 Jahre"
            />
          </div>
          <div>
            <Label className="mb-2 block">Modelle</Label>
            <div className="flex gap-3">
              {[
                { id: "manus", label: "Manus (Gemini)", color: "bg-emerald-600" },
                { id: "anthropic", label: "Anthropic Claude", color: "bg-orange-600" },
                { id: "perplexity", label: "Perplexity (Sonar)", color: "bg-blue-600" },
              ].map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={providers.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) setProviders([...providers, p.id]);
                      else setProviders(providers.filter(x => x !== p.id));
                    }}
                    className="rounded"
                  />
                  <Badge className={p.color}>{p.label}</Badge>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={handleRun} disabled={running || !prompt.trim() || providers.length === 0}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {running ? "Wird verarbeitet..." : "Analyse starten"}
          </Button>
        </CardContent>
      </Card>

      {/* Sessions List */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Bisherige Analysen</h3>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />Aktualisieren
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !sessions?.length ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Bot className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Noch keine Multi-Agent-Analysen durchgeführt</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session: any) => (
            <Card key={session.id} className="hover:border-zinc-600 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{session.prompt.slice(0, 100)}{session.prompt.length > 100 ? "..." : ""}</p>
                      {getStatusBadge(session.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(session.createdAt).toLocaleString("de-CH")}
                      {session.responses && ` • ${(session.responses as any[]).length} Modelle`}
                    </p>
                    {session.status === "completed" && session.synthesis && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{session.synthesis.slice(0, 200)}...</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {session.status === "completed" && (
                      <Button variant="ghost" size="sm" onClick={() => setViewSession(session)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setDeletingSessionId(session.id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Full-screen Presentation Viewer */}
      {presentationHtml && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
            <span className="text-sm font-medium text-[#00CFC1]">Multi-Agent Präsentation</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExport(viewSession?.id)}
                disabled={exporting}
                className="gap-2 border-zinc-700 text-xs"
              >
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                PPTX
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPresentationHtml(null)}
                className="border-zinc-700 text-xs"
              >
                × Schliessen
              </Button>
            </div>
          </div>
          <iframe
            srcDoc={presentationHtml}
            className="flex-1 w-full border-0"
            title="Multi-Agent Präsentation"
          />
        </div>
      )}

      {/* Session Detail Dialog */}
      <Dialog open={!!viewSession} onOpenChange={() => { setViewSession(null); setPresentationHtml(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Multi-Agent Analyse</DialogTitle>
          </DialogHeader>
          {viewSession && (
            <div className="space-y-4 pt-2">
              {/* Synthesis first - most important */}
              {viewSession.synthesis && (
                <div className="border-2 border-[#00CFC1]/30 rounded-lg p-4 bg-[#00CFC1]/5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#00CFC1]" />
                      Best-Practice-Empfehlung
                    </h4>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGeneratePresentation(viewSession.id)}
                        disabled={generatingPresentation}
                        className="gap-2 border-[#00CFC1]/40 text-[#00CFC1] hover:bg-[#00CFC1]/10"
                      >
                        {generatingPresentation ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {generatingPresentation ? "Erstelle..." : "Präsentation"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExport(viewSession.id)}
                        disabled={exporting}
                        className="gap-2 border-zinc-700"
                      >
                        {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        PPTX
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{viewSession.synthesis}</p>
                </div>
              )}

              {/* Prompt */}
              <div className="bg-zinc-900 rounded-lg p-3">
                <h4 className="font-medium text-xs text-muted-foreground mb-1">Frage</h4>
                <p className="text-sm">{viewSession.prompt}</p>
              </div>

              {/* Individual responses - collapsed by default */}
              {viewSession.responses && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Einzelantworten der Modelle</h4>
                  {(viewSession.responses as any[]).map((r: any, i: number) => {
                    const isExpanded = expandedResponse === i;
                    const preview = r.response.replace(/[\*#]/g, "").substring(0, 280);
                    return (
                      <div key={i} className="border border-zinc-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <Badge className={
                            r.provider.includes("Anthropic") ? "bg-orange-600" :
                            r.provider.includes("Perplexity") ? "bg-blue-600" : "bg-emerald-600"
                          }>
                            {r.provider}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {r.tokens} Tokens • {(r.durationMs / 1000).toFixed(1)}s
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => setExpandedResponse(isExpanded ? null : i)}
                            >
                              {isExpanded ? "Weniger" : "Mehr"}
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {isExpanded ? r.response : preview + (r.response.length > 280 ? "..." : "")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Löschbestätigung (U-08) */}
      <ConfirmDialog
        open={deletingSessionId !== null}
        onOpenChange={(open) => { if (!open) setDeletingSessionId(null); }}
        title="Session löschen?"
        description="Die Multi-Agent-Session inklusive aller Antworten wird dauerhaft gelöscht."
        confirmLabel="Session löschen"
        onConfirm={() => { if (deletingSessionId !== null) handleDelete(deletingSessionId); }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

// ============================================
// API Keys Management Tab
// ============================================
function ApiKeysTab() {
  const { data: secrets, isLoading, refetch } = trpc.secrets.list.useQuery();
  const setSecretMutation = trpc.secrets.set.useMutation();
  const deleteSecretMutation = trpc.secrets.delete.useMutation();
  
  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDescription, setNewDescription] = useState("");
  // U-08: Löschbestätigung über AlertDialog statt Browser-confirm()
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      toast.error("Key und Value sind erforderlich");
      return;
    }
    try {
      await setSecretMutation.mutateAsync({
        key: newKey.trim(),
        value: newValue.trim(),
        description: newDescription.trim() || undefined,
      });
      toast.success(`Secret "${newKey}" gespeichert`);
      setAddOpen(false);
      setNewKey("");
      setNewValue("");
      setNewDescription("");
      refetch();
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await deleteSecretMutation.mutateAsync({ key });
      toast.success(`Secret "${key}" gelöscht`);
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">API-Verwaltung</h2>
          <p className="text-sm text-muted-foreground">
            API-Keys und Secrets für externe Dienste (Anthropic, Perplexity, etc.)
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Hinzufügen</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neues Secret hinzufügen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Key (Name)</Label>
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="z.B. ANTHROPIC_API_KEY"
                />
              </div>
              <div>
                <Label>Value (Wert)</Label>
                <Input
                  type="password"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="sk-ant-..."
                />
              </div>
              <div>
                <Label>Beschreibung (optional)</Label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="z.B. Anthropic Claude API für Multi-Agent"
                />
              </div>
              <Button onClick={handleAdd} disabled={!newKey.trim() || !newValue.trim()} className="w-full">
                <Key className="h-4 w-4 mr-2" />
                Secret speichern
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !secrets?.length ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Key className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Keine Secrets konfiguriert</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {secrets.map((s: any) => (
            <Card key={s.key}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-[#00CFC1]" />
                    <span className="font-mono text-sm font-medium">{s.key}</span>
                  </div>
                  {s.description && (
                    <p className="text-xs text-muted-foreground ml-6">{s.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground ml-6">
                    Aktualisiert: {new Date(s.updatedAt).toLocaleString("de-CH")}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDeletingKey(s.key)}>
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Löschbestätigung (U-08) */}
      <ConfirmDialog
        open={deletingKey !== null}
        onOpenChange={(open) => { if (!open) setDeletingKey(null); }}
        title={`Secret «${deletingKey ?? ''}» löschen?`}
        description="Der gespeicherte API-Schlüssel wird dauerhaft entfernt. Dienste, die ihn verwenden, funktionieren danach nicht mehr."
        confirmLabel="Secret löschen"
        onConfirm={() => { if (deletingKey !== null) handleDelete(deletingKey); }}
        isPending={deleteSecretMutation.isPending}
      />
    </div>
  );
}

// ============================================
// Main Page
// ============================================
export default function AdminResearch() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Brain className="h-8 w-8 text-[#00CFC1]" />
            Research & Multi-Agent
          </h1>
          <p className="text-muted-foreground mt-1">
            Dokumente hochladen, KI-Analyse und Multi-Agent-System für Best-Practice-Empfehlungen
          </p>
        </div>

        <Tabs defaultValue="documents" className="w-full">
          <TabsList>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />Research
            </TabsTrigger>
            <TabsTrigger value="multiagent" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />Multi-Agent
            </TabsTrigger>
            <TabsTrigger value="apikeys" className="flex items-center gap-2">
              <Key className="h-4 w-4" />API-Keys
            </TabsTrigger>
            <TabsTrigger value="macro" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />Makro-Quellen
            </TabsTrigger>
          </TabsList>
          <TabsContent value="documents" className="mt-4">
            <ResearchDocumentsTab />
          </TabsContent>
          <TabsContent value="multiagent" className="mt-4">
            <MultiAgentTab />
          </TabsContent>
          <TabsContent value="apikeys" className="mt-4">
            <ApiKeysTab />
          </TabsContent>
          <TabsContent value="macro" className="mt-4">
            <MacroSourcesTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
