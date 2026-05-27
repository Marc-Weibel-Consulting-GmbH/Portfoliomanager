import { useState, useEffect, useRef, useMemo } from 'react';
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
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
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
} from 'lucide-react';

export default function CopilotHub() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('insights');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs font-medium tracking-widest text-teal-400 uppercase mb-1">COPILOT</p>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Dein KI-Portfolio-Assistent</h1>
              <p className="text-sm text-slate-400 mt-1">
                Insights, Chat und History — eine einzige KI-Oberfläche.
              </p>
            </div>
            <Badge variant="outline" className="border-teal-500/30 text-teal-400 text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              POWERED BY AI
            </Badge>
          </div>
        </div>

        {/* Info Banner */}
        <div className="rounded-lg bg-fuchsia-950/40 border border-fuchsia-500/30 px-4 py-2.5 text-xs text-fuchsia-200">
          <span className="font-semibold">Ersetzt</span> 3 separate KI-Pages: AI-Insights + PortfolioCopilot + Chat.
          Der Floating-Chat-Button öffnet weiterhin den Chat-Tab von überall in der App.
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border border-slate-700/50">
            <TabsTrigger value="insights" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
              Insights
              <InsightsBadge />
            </TabsTrigger>
            <TabsTrigger value="chat" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
              Chat
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
              History
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ─── Insights Badge ─── */
function InsightsBadge() {
  const { user } = useAuth();
  const { data: weeklyReview } = trpc.copilot.getLatestWeeklyReview.useQuery(undefined, {
    enabled: !!user,
  });
  const count = weeklyReview?.insights?.length ?? 0;
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
  const { data: weeklyReview, isLoading, refetch } = trpc.copilot.getLatestWeeklyReview.useQuery(undefined, {
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-48 bg-slate-800/50" />
        ))}
      </div>
    );
  }

  const insightItems = weeklyReview?.insights ?? [];

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

function InsightCard({ insight }: { insight: any }) {
  const severityConfig: Record<string, { icon: any; color: string; bg: string }> = {
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
    positive: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
    info: { icon: Lightbulb, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
    action: { icon: Target, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/30' },
  };

  const severity = insight.severity ?? 'info';
  const config = severityConfig[severity] ?? severityConfig.info;
  const Icon = config.icon;

  return (
    <Card className={`${config.bg} border`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-slate-900/50`}>
            <Icon className={`w-4 h-4 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{insight.title}</h3>
            <p className="text-xs text-slate-400 mt-1 line-clamp-3">{insight.description}</p>
          </div>
        </div>
        {insight.action && (
          <Button
            variant="ghost"
            size="sm"
            className="text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 p-0 h-auto text-xs"
          >
            <ArrowRight className="w-3 h-3 mr-1" />
            {insight.action}
          </Button>
        )}
      </CardContent>
    </Card>
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
