import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Upload, FileText, Brain, Sparkles, Trash2, RefreshCw, Clock,
  CheckCircle, AlertCircle, Loader2, Send, Bot, Eye, Plus, Key, Download
} from "lucide-react";

// ============================================
// Research Documents Tab
// ============================================
function ResearchDocumentsTab() {
  const { data: documents, isLoading, refetch } = trpc.researchAdmin.listDocuments.useQuery();
  const uploadMutation = trpc.researchAdmin.uploadDocument.useMutation();
  const deleteMutation = trpc.researchAdmin.deleteDocument.useMutation();
  const reanalyzeMutation = trpc.researchAdmin.reanalyzeDocument.useMutation();
  
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewDoc, setViewDoc] = useState<any>(null);
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
    if (!confirm("Dokument wirklich löschen?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Dokument gelöscht");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
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
      case "analyzing": return <Badge className="bg-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Analyse...</Badge>;
      case "extracting": return <Badge className="bg-yellow-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Extraktion...</Badge>;
      case "error": return <Badge className="bg-red-600"><AlertCircle className="h-3 w-3 mr-1" />Fehler</Badge>;
      default: return <Badge className="bg-gray-600"><Clock className="h-3 w-3 mr-1" />Warten</Badge>;
    }
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
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)}>
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
      // Open in new tab
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
    if (!confirm("Session wirklich löschen?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Session gelöscht");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
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
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(session.id)}>
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
    if (!confirm(`Secret "${key}" wirklich löschen?`)) return;
    try {
      await deleteSecretMutation.mutateAsync({ key });
      toast.success(`Secret "${key}" gelöscht`);
      refetch();
    } catch (e: any) {
      toast.error(e.message);
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
                <Button variant="ghost" size="sm" onClick={() => handleDelete(s.key)}>
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
