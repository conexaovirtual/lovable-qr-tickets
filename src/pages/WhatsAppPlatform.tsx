import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageSquare, Bot, Wifi, WifiOff, BarChart3 } from "lucide-react";
import { ConversationList, type Conversation } from "@/components/whatsapp-platform/ConversationList";
import { ChatArea } from "@/components/whatsapp-platform/ChatArea";
import { ContactInfoPanel } from "@/components/whatsapp-platform/ContactInfoPanel";
import { MetricsDashboard } from "@/components/whatsapp-platform/MetricsDashboard";

const WhatsAppPlatform = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [activeTab, setActiveTab] = useState<"inbox" | "metrics">("inbox");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  // Fetch conversations + realtime
  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      const { data } = await supabase
        .from("waba_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (data) setConversations(data as Conversation[]);
    };

    fetchConversations();

    const channel = supabase
      .channel("platform-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "waba_conversations" },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Conversation;
            setConversations((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
                .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
            );
            setSelectedConversation((prev) =>
              prev?.id === updated.id ? updated : prev
            );
          } else {
            fetchConversations();
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setActiveTab("inbox");
    setShowInfo(false);
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setShowInfo(false);
  };

  if (loading) return null;

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Top Bar */}
      <div className="h-12 border-b px-2 sm:px-4 flex items-center gap-2 bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold leading-tight truncate">WhatsApp</h1>
            <p className="text-[10px] text-muted-foreground leading-tight hidden sm:block">Atendimento inteligente com IA</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="flex items-center gap-1">
            {isConnected ? (
              <Wifi className="h-3.5 w-3.5 text-success" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className="text-xs text-muted-foreground hidden md:inline">
              {isConnected ? "Conectado" : "Desconectado"}
            </span>
          </div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "inbox" | "metrics")} className="border-l pl-1 sm:pl-2 ml-0.5 sm:ml-1">
            <TabsList className="h-7 p-0.5">
              <TabsTrigger value="inbox" className="text-xs h-6 px-1.5 sm:px-2 gap-1">
                <MessageSquare className="h-3 w-3" />
                <span className="hidden sm:inline">Inbox</span>
              </TabsTrigger>
              <TabsTrigger value="metrics" className="text-xs h-6 px-1.5 sm:px-2 gap-1">
                <BarChart3 className="h-3 w-3" />
                <span className="hidden sm:inline">Métricas</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {activeTab === "metrics" ? (
          <div className="flex-1 overflow-auto">
            <MetricsDashboard />
          </div>
        ) : (
          <>
            {/* Conversation List - hidden on mobile when chat is open */}
            <div className={`w-full md:w-80 lg:w-96 shrink-0 ${selectedConversation ? "hidden md:block" : "block"}`}>
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversation?.id || null}
                onSelect={handleSelectConversation}
              />
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex min-w-0 ${!selectedConversation ? "hidden md:flex" : "flex"}`}>
              <ChatArea
                conversation={selectedConversation}
                onToggleInfo={() => setShowInfo(!showInfo)}
                showInfo={showInfo}
                onBack={handleBack}
              />
            </div>

            {/* Contact Info Panel - overlay on mobile, sidebar on desktop */}
            {showInfo && selectedConversation && (
              <>
                {/* Mobile overlay backdrop */}
                <div
                  className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
                  onClick={() => setShowInfo(false)}
                />
                <div className="fixed inset-y-0 right-0 w-full max-w-sm z-50 md:relative md:inset-auto md:w-80 md:z-auto animate-in slide-in-from-right duration-200">
                  <ContactInfoPanel
                    conversation={selectedConversation}
                    onClose={() => setShowInfo(false)}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WhatsAppPlatform;
