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
  MessageSquare, Info, Ticket
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
}

export function ChatArea({ conversation, onToggleInfo, showInfo }: ChatAreaProps) {
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
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-20 h-20">
            <MessageSquare className="h-20 w-20 text-muted-foreground/20" />
            <Bot className="h-8 w-8 absolute -bottom-1 -right-1 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">Plataforma WhatsApp</p>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione uma conversa para iniciar o atendimento
            </p>
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
            <span className="flex items-center gap-1"><Bot className="h-3.5 w-3.5 text-primary" /> IA Autônoma</span>
            <span className="flex items-center gap-1"><Ticket className="h-3.5 w-3.5 text-primary" /> Abertura Automática</span>
            <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5 text-primary" /> Atendimento Híbrido</span>
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
      <div className="h-14 border-b px-4 flex items-center gap-3 bg-card shrink-0">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {(conversation.contact_name || conversation.phone_number).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {conversation.contact_name || conversation.phone_number}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" /> {conversation.phone_number}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {conversation.ai_enabled ? "IA Ativa" : "Manual"}
            </span>
            <Switch
              checked={conversation.ai_enabled}
              onCheckedChange={toggleAI}
            />
            <Bot className={`h-4 w-4 ${conversation.ai_enabled ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <Button variant="ghost" size="icon" onClick={onToggleInfo}
            className={showInfo ? "bg-accent" : ""}>
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-muted/20">
        <div className="p-4 space-y-1 max-w-3xl mx-auto">
          {groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <Badge variant="secondary" className="text-[10px] font-normal px-3">
                  {format(new Date(group.date), "dd 'de' MMMM", { locale: undefined })}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {group.msgs.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 shadow-sm ${
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
                            {msg.sender_type === "ai" ? "Assistente IA" : "Técnico"}
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
                ))}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3 bg-card shrink-0">
        {conversation.ai_enabled && (
          <div className="flex items-center gap-2 mb-2 px-1 max-w-3xl mx-auto">
            <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">
              IA respondendo automaticamente • Envie para intervir manualmente
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
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
