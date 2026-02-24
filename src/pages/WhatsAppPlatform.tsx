import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Bot, Wifi, WifiOff } from "lucide-react";
import { ConversationList, type Conversation } from "@/components/whatsapp-platform/ConversationList";
import { ChatArea } from "@/components/whatsapp-platform/ChatArea";
import { ContactInfoPanel } from "@/components/whatsapp-platform/ContactInfoPanel";

const WhatsAppPlatform = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

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
            // Update selected if same
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
  };

  if (loading) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="h-12 border-b px-4 flex items-center gap-3 bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Plataforma WhatsApp</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">Atendimento inteligente com IA</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            {isConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-success" />
                <span className="text-muted-foreground hidden sm:inline">Conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-destructive" />
                <span className="text-muted-foreground hidden sm:inline">Desconectado</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs border-l pl-2 ml-1">
            <Bot className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground hidden sm:inline">
              {conversations.filter((c) => c.ai_enabled).length} conversas com IA
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
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
          />

          {/* Contact Info Panel */}
          {showInfo && selectedConversation && (
            <ContactInfoPanel
              conversation={selectedConversation}
              onClose={() => setShowInfo(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppPlatform;
