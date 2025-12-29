import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, X, Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function FloatingChatButton() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  // Fetch conversations
  const { data: conversations } = trpc.chat.getConversations.useQuery(
    undefined,
    { enabled: isAuthenticated && isOpen }
  );

  // Fetch messages for selected conversation
  const { data: messages } = trpc.chat.getMessages.useQuery(
    { conversationId: selectedConversationId! },
    { enabled: !!selectedConversationId && isOpen }
  );

  // Create conversation mutation
  const createConversation = trpc.chat.createConversation.useMutation({
    onSuccess: (data) => {
      utils.chat.getConversations.invalidate();
      setSelectedConversationId(data.id);
    },
    onError: (error) => {
      toast.error("Fehler beim Erstellen der Konversation: " + error.message);
    },
  });

  // Send message mutation
  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      utils.chat.getMessages.invalidate({ conversationId: selectedConversationId! });
      utils.chat.getConversations.invalidate();
      setMessage("");
    },
    onError: (error) => {
      toast.error("Fehler beim Senden der Nachricht: " + error.message);
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-select or create conversation when opening
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      if (conversations && conversations.length > 0 && !selectedConversationId) {
        setSelectedConversationId(conversations[0].id);
      } else if (conversations && conversations.length === 0) {
        createConversation.mutate({});
      }
    }
  }, [isOpen, conversations, selectedConversationId, isAuthenticated]);

  const handleSendMessage = () => {
    if (!message.trim() || !selectedConversationId) return;
    sendMessage.mutate({
      conversationId: selectedConversationId,
      message: message.trim(),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 group">
        {/* Tooltip Text */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm font-medium whitespace-nowrap">
          Wie kann ich Dir helfen?
        </div>
        
        {/* Avatar Button */}
        <button
          onClick={() => setIsOpen(true)}
          className="relative bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        >
          <MessageSquare className="h-6 w-6" />
          {/* Pulse animation */}
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </button>
      </div>

      {/* Chat Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 bg-primary">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <MessageSquare className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle>KI-Assistent</DialogTitle>
                  <p className="text-xs text-muted-foreground">Wie kann ich Dir helfen?</p>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Messages Area */}
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-4">
              {messages && messages.length > 0 ? (
                messages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Stellen Sie mir eine Frage zu Ihrem Portfolio!</p>
                </div>
              )}
              {sendMessage.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t px-6 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nachricht eingeben..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={sendMessage.isPending || !selectedConversationId}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || sendMessage.isPending || !selectedConversationId}
                size="icon"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
