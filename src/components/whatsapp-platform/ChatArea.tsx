import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Send, Bot, UserRound, Phone, CheckCheck, Check, Clock,
  MessageSquare, Info, Ticket, ArrowLeft, AlertTriangle, CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Conversation } from "./ConversationList";

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
  sender_type: string;
}

interface ChatAreaProps {
  conversation: Conversation | null;
  onToggleInfo: () => void;
  showInfo: boolean;
  onBack?: () => void;
}

export function ChatArea({ conversation, onToggleInfo, showInfo, onBack }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  useEffect(() => {
    if (!conversation) { setMessages([]); return; }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("waba_messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
    };

    fetchMessages();

    const channel = supabase
      .channel(`platform-msgs-${conversation.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "waba_messages",
        filter: `conversation_id=eq.${conversation.id}`,
      }, (payload) => setMessages((prev) => [...prev, payload.new as Message]))
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "waba_messages",
        filter: `conversation_id=eq.${conversation.id}`,
      }, (payload) => setMessages((prev) =>
        prev.map((m) => (m.id === (payload.new as Message).id ? (payload.new as Message) : m))
      ))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !conversation || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("waba-send", {
        body: {
          action: "send_text",
          phone: conversation.phone_number,
          text: newMessage,
          conversation_id: conversation.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error.message || data.error);
      setNewMessage("");
      // Auto-disable AI when human agent intervenes
      if (conversation.ai_enabled) {
        await supabase
          .from("waba_conversations")
          .update({ ai_enabled: false })
          .eq("id", conversation.id);
        toast.success("IA desativada — você assumiu o atendimento");
      }
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const toggleAI = async (enabled: boolean) => {
    if (!conversation) return;
    const { error } = await supabase
      .from("waba_conversations")
      .update({ ai_enabled: enabled })
      .eq("id", conversation.id);
    if (error) { toast.error("Erro ao alterar IA"); return; }
    toast.success(enabled ? "IA ativada" : "Modo manual ativado");
  };

  const resolveConversation = async () => {
    if (!conversation) return;
    const { error } = await supabase
      .from("waba_conversations")
      .update({ queue_status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", conversation.id);
    if (error) { toast.error("Erro ao resolver"); return; }
    toast.success("Conversa marcada como resolvida");
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "read": return <CheckCheck className="h-3 w-3 text-primary" />;
      case "delivered": return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "sent": return <Check className="h-3 w-3 text-muted-foreground" />;
      case "pending": return <Clock className="h-3 w-3 text-muted-foreground" />;
      default: return null;
    }
  };

  // Empty state
  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30 p-6">
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20">
            <MessageSquare className="h-full w-full text-muted-foreground/20" />
            <Bot className="h-6 w-6 sm:h-8 sm:w-8 absolute -bottom-1 -right-1 text-primary" />
          </div>
          <div>
            <p className="text-base sm:text-lg font-semibold text-foreground">Plataforma WhatsApp</p>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione uma conversa para iniciar o atendimento
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground pt-2">
            <span className="flex items-center gap-1"><Bot className="h-3.5 w-3.5 text-primary" /> IA Autônoma</span>
            <span className="flex items-center gap-1"><Ticket className="h-3.5 w-3.5 text-primary" /> Auto Tickets</span>
            <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5 text-primary" /> Híbrido</span>
          </div>
        </div>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  messages.forEach((msg) => {
    const dateKey = format(new Date(msg.created_at), "yyyy-MM-dd");
    const last = groupedMessages[groupedMessages.length - 1];
    if (last?.date === dateKey) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date: dateKey, msgs: [msg] });
    }
  });

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Chat Header */}
      <div className="h-13 sm:h-14 border-b px-2 sm:px-4 flex items-center gap-2 sm:gap-3 bg-card shrink-0">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm font-semibold">
            {(conversation.contact_name || conversation.phone_number).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {conversation.contact_name || conversation.phone_number}
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{conversation.phone_number}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {conversation.queue_status !== "resolved" && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2" onClick={resolveConversation}>
              <CheckCircle2 className="h-3 w-3" />
              <span className="hidden sm:inline">Resolver</span>
            </Button>
          )}
          {conversation.queue_status === "resolved" && (
            <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30 px-1.5">✓</Badge>
          )}
          <div className="flex items-center gap-1.5">
            <Switch
              checked={conversation.ai_enabled}
              onCheckedChange={toggleAI}
              className="scale-90 sm:scale-100"
            />
            <Bot className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${conversation.ai_enabled ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <Button variant="ghost" size="icon" onClick={onToggleInfo}
            className={`h-8 w-8 ${showInfo ? "bg-accent" : ""}`}>
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-muted/20">
        <div className="p-3 sm:p-4 space-y-1 max-w-3xl mx-auto">
          {groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <Badge variant="secondary" className="text-[10px] font-normal px-3">
                  {format(new Date(group.date), "dd 'de' MMMM", { locale: undefined })}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {group.msgs.map((msg) => {
                  // System events
                  if (msg.message_type === "system" || msg.sender_type === "system") {
                    const isEscalation = msg.content?.includes("Escalado");
                    const isResolved = msg.content?.includes("resolvida");
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs max-w-[90%] ${
                          isEscalation ? "bg-warning/15 text-warning" : isResolved ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                        }`}>
                          {isEscalation ? <AlertTriangle className="h-3 w-3 shrink-0" /> : isResolved ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <Info className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{msg.content}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                  <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
                      msg.direction === "outbound"
                        ? msg.sender_type === "ai"
                          ? "bg-primary/85 text-primary-foreground rounded-br-sm"
                          : "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card rounded-bl-sm border"
                    }`}>
                      {msg.direction === "outbound" && msg.sender_type !== "user" && (
                        <div className="flex items-center gap-1 mb-0.5 opacity-70">
                          {msg.sender_type === "ai" ? <Bot className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                          <span className="text-[10px] font-medium">
                            {msg.sender_type === "ai" ? "IA" : "Técnico"}
                          </span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                      <div className={`flex items-center gap-1 mt-0.5 ${
                        msg.direction === "outbound" ? "justify-end" : "justify-start"
                      }`}>
                        <span className="text-[10px] opacity-60">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
                        {msg.direction === "outbound" && getStatusIcon(msg.status)}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-2 sm:p-3 bg-card shrink-0 pb-[env(safe-area-inset-bottom,8px)]">
        {conversation.ai_enabled && (
          <div className="flex items-center gap-2 mb-1.5 px-1 max-w-3xl mx-auto">
            <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">
              IA respondendo • Envie para intervir
            </span>
          </div>
        )}
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Input
            placeholder={conversation.ai_enabled ? "Intervir manualmente..." : "Digite uma mensagem..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={sending}
            className="flex-1 h-10"
          />
          <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon" className="h-10 w-10 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
