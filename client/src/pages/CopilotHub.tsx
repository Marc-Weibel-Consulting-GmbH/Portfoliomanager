import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Brain,
  Send,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Target,
  History,
  MessageSquare,
  Sparkles,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Zap,
  Link as LinkIcon,
  PieChart,
  TrendingDown,
  DollarSign,
  Activity,
} from 'lucide-react';
import { Link } from 'wouter';

export default function CopilotHub() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const urlTab = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('tab') || 'insights') : 'insights';
  const [activeTab, setActiveTab] = useState(urlTab);
  
  const handleCopilotTabChange = (tab: string) => {
    setActiveTab(tab);
    const newSearch = tab === 'insights' ? '' : `?tab=${tab}`;
    navigate(`/copilot${newSearch}`, { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium tracking-widest text-[#00CFC1] uppercase mb-1">COPILOT</p>
            <h1 className="text-2xl font-bold text-white">KI-Portfolio-Assistent</h1>
            <p className="text-sm text-gray-400 mt-1">Insights, Chat und History — eine einzige KI-Oberfläche.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-[#00CFC1]/30 text-[#00CFC1] text-[10px] px-2 py-1">
              <Brain className="w-3 h-3 mr-1" />
              CLAUDE · HAIKU 4.5
            </Badge>
            <Badge variant="outline" className="border-white/10 text-gray-400 text-[10px] px-2 py-1">
              <Sparkles className="w-3 h-3 mr-1" />
              AI-POWERED
            </Badge>
          </div>
        </div>

        {/* Tabs — underline style matching design */}
        <Tabs value={activeTab} onValueChange={handleCopilotTabChange}>
          <TabsList className="flex gap-0 bg-transparent border-b border-white/10 p-0 h-auto rounded-none w-full justify-start">
            <TabsTrigger value="insights" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00CFC1] data-[state=active]:text-[#00CFC1] data-[state=active]:bg-transparent text-gray-400 text-sm px-4 pb-3 pt-2 gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" /> Insights <InsightsBadge />
            </TabsTrigger>
            <TabsTrigger value="chat" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00CFC1] data-[state=active]:text-[#00CFC1] data-[state=active]:bg-transparent text-gray-400 text-sm px-4 pb-3 pt-2 gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Chat
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00CFC1] data-[state=active]:text-[#00CFC1] data-[state=active]:bg-transparent text-gray-400 text-sm px-4 pb-3 pt-2 gap-1.5">
              <History className="w-3.5 h-3.5" /> History
            </TabsTrigger>
            <TabsTrigger value="signals" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00CFC1] data-[state=active]:text-[#00CFC1] data-[state=active]:bg-transparent text-gray-400 text-sm px-4 pb-3 pt-2 gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Signal-Feed
            </TabsTrigger>
            <TabsTrigger value="deepdive" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00CFC1] data-[state=active]:text-[#00CFC1] data-[state=active]:bg-transparent text-gray-400 text-sm px-4 pb-3 pt-2 gap-1.5">
              <PieChart className="w-3.5 h-3.5" /> Deep-Dive
            </TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="mt-6">
            <InsightsTab />
          </TabsContent>

          <TabsContent value="chat" className="mt-6">
            <ChatTab />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <HistoryTab />
          </TabsContent>
          <TabsContent value="signals" className="mt-6">
            <SignalFeedTab />
          </TabsContent>
          <TabsContent value="deepdive" className="mt-6">
            <DeepDiveTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ─── Insights Badge ─── */
function InsightsBadge() {
  const { user } = useAuth();
  const { data: insights } = trpc.dashboard.getCopilotInsights.useQuery(
    { scope: 'aggregate' },
    { enabled: !!user, staleTime: 60000 }
  );
  const count = insights?.length ?? 0;
  if (count === 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold">
      {count}
    </span>
  );
}

/* ─── Insights Tab ─── */
function InsightsTab() {
  const { user } = useAuth();
  // Echte, deterministisch aus dem Portfolio berechnete Insights (Konzentration,
  // Performance, Risiko …) — dashboard.getCopilotInsights liefert ≥3 Karten (Mockup S.18).
  const { data: insightItems = [], isLoading, refetch } = trpc.dashboard.getCopilotInsights.useQuery(
    { scope: 'aggregate' },
    { enabled: !!user, staleTime: 60000 }
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-48 bg-slate-800/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
            LIVE
          </Badge>
          <span className="text-xs text-slate-400">
            {insightItems.length} neue · AI · aktualisiert
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="text-slate-400 hover:text-teal-400"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Aktualisieren
        </Button>
      </div>

      {insightItems.length === 0 ? (
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="py-12 text-center">
            <Brain className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">Keine neuen Insights verfügbar.</p>
            <p className="text-xs text-slate-500 mt-1">Die KI analysiert dein Portfolio regelmässig.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insightItems.map((insight: any, idx: number) => (
            <InsightCard key={idx} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}

// Map action text to actionType for the modal
function getActionType(action: string): 'sektoren' | 'top_positionen' | 'diversifikation' | 'rebalancing' | 'generic' {
  const a = action?.toLowerCase() || '';
  if (a.includes('sektor')) return 'sektoren';
  if (a.includes('position') || a.includes('top-pos')) return 'top_positionen';
  if (a.includes('diversif')) return 'diversifikation';
  if (a.includes('rebalanc')) return 'rebalancing';
  return 'generic';
}

function InsightActionModal({ open, onClose, insight }: { open: boolean; onClose: () => void; insight: any }) {
  const actionType = getActionType(insight?.action || '');
  const [result, setResult] = useState<string | null>(null);
  const executeAction = trpc.dashboard.executeInsightAction.useMutation({
    onSuccess: (data) => setResult(typeof data.result === 'string' ? data.result : String(data.result)),
    onError: (err) => { toast.error('Fehler: ' + err.message); onClose(); },
  });

  useEffect(() => {
    if (open && !result && !executeAction.isPending) {
      setResult(null);
      executeAction.mutate({ actionType, context: insight?.title });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => { setResult(null); onClose(); };

  const titleMap: Record<string, string> = {
    sektoren: 'Sektoren überprüfen',
    top_positionen: 'Top-Positionen analysieren',
    diversifikation: 'Diversifikation prüfen',
    rebalancing: 'Rebalancing-Vorschläge',
    generic: 'KI-Analyse',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0f1420] border-[#00CFC1]/30 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#00CFC1]" />
            {titleMap[actionType]}
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-xs">
            {insight?.title} — KI-Analyse Ihres Portfolios
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          {executeAction.isPending && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-[#00CFC1] animate-spin" />
              <p className="text-gray-400 text-sm">KI analysiert Ihr Portfolio...</p>
              <p className="text-gray-500 text-xs">Dauert ca. 10–30 Sekunden</p>
            </div>
          )}
          {result && (
            <div className="prose prose-invert prose-sm max-w-none text-gray-300 [&_h2]:text-[#00CFC1] [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_ul]:text-gray-300 [&_li]:text-gray-300 [&_strong]:text-white">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InsightCard({ insight }: { insight: any }) {
  const [modalOpen, setModalOpen] = useState(false);
  const severityConfig: Record<string, { icon: any; color: string; borderColor: string; label: string }> = {
    warning: { icon: AlertTriangle, color: 'text-amber-400', borderColor: 'border-l-amber-400', label: 'WARNUNG' },
    watch: { icon: AlertTriangle, color: 'text-amber-400', borderColor: 'border-l-amber-400', label: 'BEOBACHTEN' },
    positive: { icon: TrendingUp, color: 'text-[#00CFC1]', borderColor: 'border-l-[#00CFC1]', label: 'POSITIV' },
    info: { icon: Lightbulb, color: 'text-blue-400', borderColor: 'border-l-blue-400', label: 'INFO' },
    action: { icon: Target, color: 'text-[#00CFC1]', borderColor: 'border-l-[#00CFC1]', label: 'AKTION' },
  };

  const severity = insight.severity ?? 'info';
  const config = severityConfig[severity] ?? severityConfig.info;
  const Icon = config.icon;
  const bodyText = insight.body ?? insight.description;
  const actionType = getActionType(insight?.action || '');
  const isModalAction = ['sektoren', 'top_positionen', 'diversifikation', 'rebalancing'].includes(actionType);

  return (
    <>
      <div className={`bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 border-l-4 ${config.borderColor} rounded-lg p-4`}>
        <div className="flex items-start gap-3 mb-3">
          <div className="p-1.5 rounded-lg bg-white/5 mt-0.5">
            <Icon className={`w-4 h-4 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] font-bold tracking-widest ${config.color}`}>{config.label}</span>
            </div>
            <h3 className="text-sm font-semibold text-white leading-snug">{insight.title}</h3>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed line-clamp-3">{bodyText}</p>
          </div>
        </div>
        {insight.action && (
          isModalAction ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(true)}
              className="text-[#00CFC1] border-[#00CFC1]/40 hover:bg-[#00CFC1]/10 hover:text-[#00CFC1] text-xs h-7 px-3"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {insight.action}
            </Button>
          ) : insight.actionHref ? (
            <Link href={insight.actionHref}>
              <Button variant="outline" size="sm" className="text-[#00CFC1] border-[#00CFC1]/40 hover:bg-[#00CFC1]/10 hover:text-[#00CFC1] text-xs h-7 px-3">
                <ArrowRight className="w-3 h-3 mr-1" />
                {insight.action}
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" className="text-[#00CFC1] border-[#00CFC1]/40 hover:bg-[#00CFC1]/10 hover:text-[#00CFC1] text-xs h-7 px-3">
              <ArrowRight className="w-3 h-3 mr-1" />
              {insight.action}
            </Button>
          )
        )}
      </div>
      {isModalAction && (
        <InsightActionModal open={modalOpen} onClose={() => setModalOpen(false)} insight={insight} />
      )}
    </>
  );
}

/* ─── Chat Tab ─── */
function ChatTab() {
  const { user, isAuthenticated } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: conversations, isLoading: loadingConversations } = trpc.chat.getConversations.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: chatMessages, isLoading: loadingMessages } = trpc.chat.getMessages.useQuery(
    { conversationId: selectedConversationId! },
    { enabled: !!selectedConversationId }
  );

  const createConversation = trpc.chat.createConversation.useMutation({
    onSuccess: (data) => {
      utils.chat.getConversations.invalidate();
      setSelectedConversationId(data.id);
      toast.success('Neue Konversation erstellt');
    },
  });

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      utils.chat.getMessages.invalidate();
      setMessage('');
    },
  });

  const deleteConversation = trpc.chat.deleteConversation.useMutation({
    onSuccess: () => {
      utils.chat.getConversations.invalidate();
      setSelectedConversationId(null);
      toast.success('Konversation gelöscht');
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    if (!message.trim() || !selectedConversationId) return;
    sendMessage.mutate({
      conversationId: selectedConversationId,
      message: message.trim(),
    });
  };

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4 h-[600px]">
      {/* Conversations sidebar */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg flex flex-col">
        <div className="p-3 border-b border-slate-700/50 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Konversationen</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-teal-400"
            onClick={() => createConversation.mutate({ title: 'Neue Konversation' })}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingConversations ? (
              <div className="p-4 text-center">
                <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-500" />
              </div>
            ) : conversations?.length === 0 ? (
              <p className="text-xs text-slate-500 p-3 text-center">Keine Konversationen</p>
            ) : (
              conversations?.map((conv: any) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                    selectedConversationId === conv.id
                      ? 'bg-teal-500/20 text-teal-400'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{conv.title}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation.mutate({ conversationId: conv.id });
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg flex flex-col">
        {!selectedConversationId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm">Wähle eine Konversation oder erstelle eine neue.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
                onClick={() => createConversation.mutate({ title: 'Neue Konversation' })}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Neue Konversation
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                  </div>
                ) : chatMessages?.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-8">
                    Stelle eine Frage zu deinem Portfolio...
                  </p>
                ) : (
                  chatMessages?.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === 'user'
                            ? 'bg-teal-500/20 text-teal-100 border border-teal-500/30'
                            : 'bg-slate-700/50 text-slate-200 border border-slate-600/50'
                        }`}
                      >
                        <div className="prose prose-invert prose-sm max-w-none">
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-slate-700/50">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Frage stellen + Copilot..."
                  className="bg-slate-900/50 border-slate-700/50 text-white placeholder:text-slate-500"
                />
                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || sendMessage.isPending}
                  className="bg-teal-500 hover:bg-teal-600 text-white"
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── History Tab ─── */
function HistoryTab() {
  const { user } = useAuth();
  const { data: history, isLoading } = trpc.copilot.getHistory.useQuery(undefined, {
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-16 bg-slate-800/50" />
        ))}
      </div>
    );
  }

  const items = history ?? [];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-white">Letzte Auswertungen</h3>
      {items.length === 0 ? (
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="py-8 text-center">
            <History className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-slate-400 text-sm">Noch keine Auswertungen vorhanden.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center gap-4 px-4 py-3 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
            >
              <span className="text-[10px] text-slate-500 font-mono w-16 shrink-0">
                {item.timeAgo ?? formatTimeAgo(item.createdAt)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{item.title}</p>
              </div>
              <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400 shrink-0">
                {item.category ?? 'ANALYSE'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Signal Feed Tab ─── */
function SignalFeedTab() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isFetching } = trpc.dashboard.getScoringWatchlist.useQuery(undefined, {
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const items: any[] = Array.isArray(data) ? data : [];

  const signalConfig = (signal: string) => {
    if (signal === 'BUY') return { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    if (signal === 'SELL') return { icon: <XCircle className="w-4 h-4 text-red-400" />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
    return { icon: <MinusCircle className="w-4 h-4 text-gray-400" />, color: 'text-gray-400', bg: 'bg-white/5 border-white/10' };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#00CFC1]" />
            Kombinations-Signal-Feed
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Momentum + Qualität + LPPL-Fit — alle Portfolio-Positionen</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}
          className="text-slate-400 hover:text-[#00CFC1]">
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 bg-slate-800/50" />)}
        </div>
      )}

      {error && (
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500/50 mb-2" />
            <p className="text-slate-400 text-sm">Keine Portfolio-Positionen verfügbar.</p>
            <p className="text-xs text-slate-500 mt-1">Füge zuerst Aktien zu einem Portfolio hinzu.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && items.length === 0 && (
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="py-8 text-center">
            <Zap className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-slate-400 text-sm">Keine Signale verfügbar.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item: any) => {
            // Backend returns: ticker, combinedScore, overallGrade, signal, momentum.grade, quality.grade, lppl.regime, error
            const symbol = item.symbol ?? item.ticker;
            const score = item.score ?? item.combinedScore;
            const grade = item.grade ?? item.overallGrade;
            const momentumGrade = item.momentumScore ?? item.momentum?.grade;
            const bubbleRisk = item.bubbleRisk ?? (item.lppl?.regime !== 'normal' ? item.lppl?.regime : null);
            const cfg = signalConfig(item.signal);
            return (
              <div key={symbol} className={`rounded-lg border p-4 ${cfg.bg}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link href={`/aktien/${symbol}`}>
                      <span className="text-[#00CFC1] font-mono font-bold text-base hover:underline cursor-pointer">{symbol}</span>
                    </Link>
                    <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{item.name ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {cfg.icon}
                    <span className={`text-sm font-bold ${cfg.color}`}>{item.signal}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-black/20 rounded px-2 py-1.5">
                    <div className="text-white font-mono font-bold text-sm">
                      {score != null ? Number(score).toFixed(0) : '–'}
                    </div>
                    <div className="text-gray-500 text-[10px]">Score</div>
                  </div>
                  <div className="bg-black/20 rounded px-2 py-1.5">
                    <div className="text-gray-300 font-mono text-sm">{grade ?? '–'}</div>
                    <div className="text-gray-500 text-[10px]">Grade</div>
                  </div>
                  <div className="bg-black/20 rounded px-2 py-1.5">
                    <div className={`font-mono text-sm ${
                      typeof momentumGrade === 'number'
                        ? (momentumGrade > 50 ? 'text-emerald-400' : 'text-red-400')
                        : (['A','B'].includes(momentumGrade) ? 'text-emerald-400' : 'text-red-400')
                    }`}>
                      {momentumGrade ?? '–'}
                    </div>
                    <div className="text-gray-500 text-[10px]">Momentum</div>
                  </div>
                </div>
                {bubbleRisk && bubbleRisk !== 'normal' && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    <span>LPPL Blasenrisiko: {bubbleRisk}</span>
                  </div>
                )}
                {item.error && (
                  <div className="mt-2 text-xs text-red-400/70 truncate">{item.error}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-2 border-t border-white/5">
        <Link href="/backtesting">
          <span className="text-[#00CFC1] text-xs hover:underline cursor-pointer flex items-center gap-1">
            <LinkIcon className="w-3 h-3" />
            Strategie-Backtest öffnen
          </span>
        </Link>
      </div>
    </div>
  );
}

// ─── Deep-Dive Tab ───────────────────────────────────────────────────────────
const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#00CFC1',
  'Healthcare': '#6366f1',
  'Financials': '#f59e0b',
  'Consumer Discretionary': '#ec4899',
  'Consumer Staples': '#10b981',
  'Industrials': '#3b82f6',
  'Energy': '#f97316',
  'Materials': '#84cc16',
  'Real Estate': '#a78bfa',
  'Utilities': '#06b6d4',
  'Communication Services': '#e879f9',
  'Unbekannt': '#64748b',
};
function sectorColor(sector: string): string {
  return SECTOR_COLORS[sector] || '#64748b';
}

function DeepDiveTab() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  const { data: portfolioList, isLoading: isLoadingPortfolios } = trpc.portfolios.list.useQuery(undefined, { 
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Auto-select first portfolio
  const portfolios: any[] = Array.isArray(portfolioList) ? portfolioList : [];
  const effectiveId = selectedPortfolioId ?? (portfolios[0]?.id ?? null);

  const { data, isLoading, error, refetch, isFetching } = trpc.copilot.portfolioDeepDive.useQuery(
    { portfolioId: effectiveId! },
    { enabled: !!effectiveId && !!user, staleTime: 10 * 60 * 1000, retry: 1 }
  );

  const fmtPct = (v: number | null | undefined) => v !== null && v !== undefined ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '–';
  const fmtNum = (v: number | null | undefined, dec = 2) => v !== null && v !== undefined ? v.toFixed(dec) : '–';

  return (
    <div className="space-y-5">
      {/* Header + Portfolio Selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#00CFC1]" />
            Portfolio Deep-Dive
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">EODHD-Fundamentaldaten + KI-Analyse</p>
        </div>
        <div className="flex items-center gap-2">
          {portfolios.length > 0 && (
            <Select
              value={String(effectiveId ?? '')}
              onValueChange={(v) => setSelectedPortfolioId(Number(v))}
            >
              <SelectTrigger className="w-44 h-8 text-xs bg-slate-800/50 border-white/10 text-white">
                <SelectValue placeholder="Portfolio wählen" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10">
                {portfolios.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)} className="text-xs text-white">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}
            className="text-slate-400 hover:text-[#00CFC1] h-8">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 bg-slate-800/50" />)}
        </div>
      )}

      {error && (
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-amber-500/50 mb-2" />
            <p className="text-slate-400 text-sm">Fehler beim Laden der Fundamentaldaten.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && data && !data.error && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Ø KGV (P/E)', value: fmtNum(data.portfolioMetrics?.avgPE, 1), icon: <BarChart3 className="w-4 h-4 text-[#00CFC1]" />, hint: 'Gewichtetes Kurs-Gewinn-Verhältnis' },
              { label: 'Ø PEG', value: fmtNum(data.portfolioMetrics?.avgPEG, 2), icon: <Activity className="w-4 h-4 text-blue-400" />, hint: 'PEG < 1 = günstig bewertet' },
              { label: 'Ø Beta', value: fmtNum(data.portfolioMetrics?.avgBeta, 2), icon: <TrendingDown className="w-4 h-4 text-amber-400" />, hint: 'Marktrisiko: 1 = Markt, >1 = aggressiv' },
              { label: 'Ø Dividende', value: data.portfolioMetrics?.avgDividendYield !== null && data.portfolioMetrics?.avgDividendYield !== undefined ? `${fmtNum(data.portfolioMetrics.avgDividendYield, 1)}%` : '–', icon: <DollarSign className="w-4 h-4 text-emerald-400" />, hint: 'Gewichtete Dividendenrendite' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">{kpi.icon}<span className="text-[10px] text-gray-500 uppercase tracking-wider">{kpi.label}</span></div>
                <div className="text-xl font-bold text-white">{kpi.value}</div>
                <div className="text-[10px] text-gray-600 mt-0.5">{kpi.hint}</div>
              </div>
            ))}
          </div>

          {/* Sector Breakdown + Top Dividend */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sector Breakdown */}
            <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                <PieChart className="w-3.5 h-3.5 text-[#00CFC1]" /> Sektorverteilung
              </h4>
              <div className="space-y-2">
                {(data.sectorBreakdown || []).map((s: any) => (
                  <div key={s.sector}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-300">{s.sector}</span>
                      <span className="text-xs font-medium" style={{ color: sectorColor(s.sector) }}>{s.weight.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(s.weight, 100)}%`, backgroundColor: sectorColor(s.sector) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Dividend + High Beta */}
            <div className="space-y-3">
              {(data.topDividend || []).length > 0 && (
                <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Top Dividendenzahler
                  </h4>
                  <div className="space-y-1.5">
                    {data.topDividend.map((d: any) => (
                      <div key={d.ticker} className="flex items-center justify-between">
                        <span className="text-xs text-gray-300">{d.ticker} <span className="text-gray-600 text-[10px]">{d.name}</span></span>
                        <span className="text-xs font-medium text-emerald-400">{fmtNum(d.yield, 1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(data.highBeta || []).length > 0 && (
                <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-amber-400" /> Höchstes Beta (Risiko)
                  </h4>
                  <div className="space-y-1.5">
                    {data.highBeta.map((b: any) => (
                      <div key={b.ticker} className="flex items-center justify-between">
                        <span className="text-xs text-gray-300">{b.ticker} <span className="text-gray-600 text-[10px]">{b.name}</span></span>
                        <span className={`text-xs font-medium ${Math.abs(b.beta) > 1.5 ? 'text-red-400' : 'text-amber-400'}`}>{fmtNum(b.beta, 2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Holdings Table */}
          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-[#00CFC1]" /> Positionen — Fundamentaldaten
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-gray-500 pb-2 pr-3">Ticker</th>
                    <th className="text-left text-gray-500 pb-2 pr-3">Sektor</th>
                    <th className="text-right text-gray-500 pb-2 pr-3">Gewicht</th>
                    <th className="text-right text-gray-500 pb-2 pr-3">KGV</th>
                    <th className="text-right text-gray-500 pb-2 pr-3">PEG</th>
                    <th className="text-right text-gray-500 pb-2 pr-3">Beta</th>
                    <th className="text-right text-gray-500 pb-2">Div.</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.holdings || []).map((h: any) => (
                    <tr key={h.ticker} className="border-b border-white/5 hover:bg-white/3">
                      <td className="py-1.5 pr-3">
                        <span className="font-medium text-white">{h.ticker}</span>
                        <span className="text-gray-600 ml-1 hidden md:inline">{h.name}</span>
                      </td>
                      <td className="py-1.5 pr-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${sectorColor(h.sector)}20`, color: sectorColor(h.sector) }}>{h.sector}</span>
                      </td>
                      <td className="py-1.5 pr-3 text-right text-gray-300">{h.weight.toFixed(1)}%</td>
                      <td className="py-1.5 pr-3 text-right text-gray-300">{h.peRatio !== null ? h.peRatio : '–'}</td>
                      <td className="py-1.5 pr-3 text-right text-gray-300">{h.pegRatio !== null ? h.pegRatio : '–'}</td>
                      <td className="py-1.5 pr-3 text-right">
                        <span className={h.beta !== null && Math.abs(h.beta) > 1.5 ? 'text-red-400' : 'text-gray-300'}>{h.beta !== null ? h.beta : '–'}</span>
                      </td>
                      <td className="py-1.5 text-right text-emerald-400">{h.dividendYield !== null && h.dividendYield > 0 ? `${h.dividendYield.toFixed(1)}%` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Summary */}
          {data.aiSummary && (
            <div className="bg-gradient-to-br from-[#0f1a1f] to-[#0a1015] border border-[#00CFC1]/20 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-[#00CFC1] mb-2 flex items-center gap-2">
                <Brain className="w-3.5 h-3.5" /> KI-Portfolioanalyse
              </h4>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{data.aiSummary}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `vor ${diffHrs} Std`;
  const diffDays = Math.floor(diffHrs / 24);
  return `vor ${diffDays} Tagen`;
}
