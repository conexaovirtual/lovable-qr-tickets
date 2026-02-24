import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Bot, Clock, MessageSquare, Users } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  status: string;
  last_message_at: string;
  created_at: string;
  ai_enabled: boolean;
  ai_context: any;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM", { locale: ptBR });
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = conversations.filter((c) => {
    const matchesSearch =
      !search ||
      c.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone_number.includes(search);

    const matchesFilter =
      filter === "all" ||
      (filter === "ai" && c.ai_enabled) ||
      (filter === "waiting" && !c.ai_enabled) ||
      (filter === "active" && c.status === "active");

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col h-full bg-card border-r">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Conversas</h2>
          <Badge variant="secondary" className="text-xs">
            {conversations.length}
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="w-full h-8">
            <TabsTrigger value="all" className="text-xs flex-1 gap-1">
              <Users className="h-3 w-3" /> Todas
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs flex-1 gap-1">
              <Bot className="h-3 w-3" /> IA
            </TabsTrigger>
            <TabsTrigger value="waiting" className="text-xs flex-1 gap-1">
              <Clock className="h-3 w-3" /> Manual
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhuma conversa</p>
            <p className="text-xs mt-1">As conversas aparecerão quando clientes enviarem mensagens</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 ${
                  selectedId === conv.id ? "bg-accent border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="relative">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                      {(conv.contact_name || conv.phone_number).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {conv.ai_enabled && (
                    <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <Bot className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <p className="font-medium text-sm truncate">
                      {conv.contact_name || conv.phone_number}
                    </p>
                    <span className="text-[11px] text-muted-foreground ml-2 whitespace-nowrap">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.phone_number}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
