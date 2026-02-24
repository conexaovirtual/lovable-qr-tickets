import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Phone,
  Search,
  User,
  Clock,
  CheckCheck,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  status: string;
  last_message_at: string;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  wamid: string | null;
  direction: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  status: string | null;
  created_at: string;
}

const WABAChat = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  // Fetch conversations
  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      const { data } = await supabase
        .from("waba_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (data) setConversations(data);
    };

    fetchConversations();

    // Realtime subscription for conversations
    const channel = supabase
      .channel("waba-conversations-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waba_conversations" },
        () => fetchConversations()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("waba_messages")
        .select("*")
        .eq("conversation_id", selectedConversation.id)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };

    fetchMessages();

    // Realtime subscription for messages
    const channel = supabase
      .channel(`waba-messages-${selectedConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "waba_messages",
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "waba_messages",
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === (payload.new as Message).id ? (payload.new as Message) : m))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedConversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("waba-send", {
        body: {
          action: "send_text",
          phone: selectedConversation.phone_number,
          text: newMessage,
          conversation_id: selectedConversation.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error.message || data.error);

      setNewMessage("");
    } catch (err: any) {
      toast.error("Erro ao enviar mensagem: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.contact_name?.toLowerCase().includes(term) ||
      c.phone_number.includes(term)
    );
  });

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "read":
        return <CheckCheck className="h-3 w-3 text-primary" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      default:
        return null;
    }
  };

  if (loading) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <MessageSquare className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">WhatsApp Business</h1>
        <Badge variant="secondary" className="ml-auto">
          {conversations.length} conversas
        </Badge>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Conversation List */}
        <div className={`w-full md:w-80 lg:w-96 border-r flex flex-col ${selectedConversation ? "hidden md:flex" : "flex"}`}>
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma conversa ainda</p>
                <p className="text-xs mt-1">As conversas aparecerão aqui quando receberem mensagens via WhatsApp</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                    selectedConversation?.id === conv.id ? "bg-accent" : ""
                  }`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(conv.contact_name || conv.phone_number).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="font-medium text-sm truncate">
                        {conv.contact_name || conv.phone_number}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {format(new Date(conv.last_message_at), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.phone_number}
                    </p>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${!selectedConversation ? "hidden md:flex" : "flex"}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="border-b px-4 py-3 flex items-center gap-3 bg-card">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {(selectedConversation.contact_name || selectedConversation.phone_number)
                      .charAt(0)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">
                    {selectedConversation.contact_name || selectedConversation.phone_number}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {selectedConversation.phone_number}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3 max-w-3xl mx-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          msg.direction === "outbound"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <div
                          className={`flex items-center gap-1 mt-1 ${
                            msg.direction === "outbound" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <span className="text-[10px] opacity-70">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                          {msg.direction === "outbound" && getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="border-t p-3 bg-card">
                <div className="flex gap-2 max-w-3xl mx-auto">
                  <Input
                    placeholder="Digite uma mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">WhatsApp Business API</p>
                <p className="text-sm mt-1">Selecione uma conversa para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WABAChat;
