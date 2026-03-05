import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Send, Hash, Users, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Channel {
  id: string;
  name: string;
  type: string;
  created_at: string;
}

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { nome: string; avatar_url: string | null };
}

const Chat = () => {
  const { user, profile } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch channels
  useEffect(() => {
    if (!user) return;
    const fetchChannels = async () => {
      const { data } = await supabase
        .from("chat_channels")
        .select("*")
        .order("updated_at", { ascending: false });
      if (data) setChannels(data);
    };
    fetchChannels();

    const channel = supabase
      .channel("chat-channels-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_channels" }, () => fetchChannels())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Fetch messages for selected channel
  useEffect(() => {
    if (!selectedChannel) { setMessages([]); return; }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("channel_id", selectedChannel.id)
        .order("created_at", { ascending: true })
        .limit(200);

      if (data) {
        // Fetch profiles for all unique user_ids
        const userIds = [...new Set(data.map((m) => m.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
        const enriched = data.map((m) => ({
          ...m,
          profile: profileMap.get(m.user_id) || { nome: "Usuário", avatar_url: null },
        }));
        setMessages(enriched);
      }
    };
    fetchMessages();

    const channel = supabase
      .channel(`chat-messages-${selectedChannel.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${selectedChannel.id}` },
        async (payload) => {
          const msg = payload.new as Message;
          const { data: prof } = await supabase
            .from("profiles")
            .select("id, nome, avatar_url")
            .eq("id", msg.user_id)
            .single();
          setMessages((prev) => [...prev, { ...msg, profile: prof || { nome: "Usuário", avatar_url: null } }]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChannel]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedChannel || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      channel_id: selectedChannel.id,
      user_id: user.id,
      content: newMessage.trim(),
    });
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } else {
      setNewMessage("");
      // Update channel's updated_at
      await supabase.from("chat_channels").update({ updated_at: new Date().toISOString() }).eq("id", selectedChannel.id);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !user) return;
    const { error } = await supabase.from("chat_channels").insert({
      name: newChannelName.trim(),
      type: "group",
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewChannelName("");
      setDialogOpen(false);
      toast({ title: "Canal criado!" });
    }
  };

  const isAdmin = profile?.roles?.includes("admin_provedor");
  const isTech = profile?.roles?.includes("tecnico");
  const canCreateChannel = isAdmin || isTech;

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <PageHeader
        icon={MessageCircle}
        title="Chat Interno"
        subtitle="Comunicação da equipe em tempo real"
        metrics={[
          { icon: Hash, label: "Canais", value: channels.length, color: "bg-blue-600/90" },
          { icon: Users, label: "Mensagens", value: messages.length, color: "bg-emerald-600/90" },
        ]}
        actions={
          canCreateChannel ? (
            <Button size="sm" className="h-8 text-xs gap-1 bg-white/10 hover:bg-white/20 text-white border-0" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Novo Canal</span>
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-1 overflow-hidden">
      {/* Channel List */}
      <div className={`w-full md:w-72 lg:w-80 border-r bg-card flex flex-col shrink-0 ${selectedChannel ? "hidden md:flex" : "flex"}`}>
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-semibold text-sm truncate">Chat Interno</h2>
          </div>
          {canCreateChannel && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Canal</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3 mt-2">
                  <Input
                    placeholder="Nome do canal..."
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateChannel()}
                  />
                  <Button onClick={handleCreateChannel} disabled={!newChannelName.trim()}>
                    Criar Canal
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <ScrollArea className="flex-1">
          {channels.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Nenhum canal ainda</p>
              {canCreateChannel && <p className="text-xs mt-1">Crie o primeiro canal!</p>}
            </div>
          ) : (
            <div className="p-1">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannel(ch)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-left transition-colors ${
                    selectedChannel?.id === ch.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <Hash className="h-4 w-4 shrink-0 opacity-60" />
                  <span className="text-sm font-medium truncate">{ch.name}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${!selectedChannel ? "hidden md:flex" : "flex"}`}>
        {selectedChannel ? (
          <>
            {/* Channel header */}
            <div className="h-12 border-b px-4 flex items-center gap-3 bg-card shrink-0">
              <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setSelectedChannel(null)}>
                ← 
              </Button>
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{selectedChannel.name}</span>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3 max-w-3xl mx-auto">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-12">
                    <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma mensagem ainda. Comece a conversa!</p>
                  </div>
                )}
                {messages.map((msg, idx) => {
                  const isMe = msg.user_id === user?.id;
                  const showAvatar = idx === 0 || messages[idx - 1].user_id !== msg.user_id;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                      {showAvatar ? (
                        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                          <AvatarFallback className={`text-xs ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            {(msg.profile?.nome || "U").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8 shrink-0" />
                      )}
                      <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                        {showAvatar && (
                          <span className={`text-xs text-muted-foreground mb-0.5 ${isMe ? "text-right" : ""}`}>
                            {isMe ? "Você" : msg.profile?.nome}
                          </span>
                        )}
                        <div
                          className={`rounded-xl px-3 py-2 text-sm ${
                            isMe
                              ? "bg-primary text-primary-foreground rounded-tr-sm"
                              : "bg-muted rounded-tl-sm"
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3 bg-card shrink-0">
              <div className="flex gap-2 max-w-3xl mx-auto">
                <Input
                  ref={inputRef}
                  placeholder="Digite uma mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  disabled={sending}
                  className="flex-1"
                />
                <Button size="icon" onClick={handleSend} disabled={!newMessage.trim() || sending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium">Chat Corporativo</p>
              <p className="text-sm">Selecione um canal para começar</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default Chat;
