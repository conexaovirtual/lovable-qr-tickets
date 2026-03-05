import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, User, Building2, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const KANBAN_COLUMNS = [
  { id: 'novo', label: 'Novo', color: 'bg-blue-500' },
  { id: 'em_atendimento', label: 'Em Atendimento', color: 'bg-amber-500' },
  { id: 'aguardando_usuario', label: 'Aguardando', color: 'bg-orange-500' },
  { id: 'resolvido', label: 'Resolvido', color: 'bg-emerald-500' },
  { id: 'fechado', label: 'Fechado', color: 'bg-slate-500' },
] as const;

type ColumnId = typeof KANBAN_COLUMNS[number]['id'];

interface KanbanTicket {
  id: string;
  numero: number;
  titulo: string;
  status: string;
  prioridade: string;
  created_at: string;
  companies?: { nome_fantasia: string } | null;
  profiles?: { nome: string } | null;
  solicitante_nome?: string | null;
  tecnico_id?: string | null;
}

export function TicketKanban() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<KanbanTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedTicket, setDraggedTicket] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id, numero, titulo, status, prioridade, created_at, tecnico_id,
        solicitante_nome,
        profiles!tickets_solicitante_id_fkey(nome),
        companies(nome_fantasia)
      `)
      .in('status', KANBAN_COLUMNS.map(c => c.id))
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar chamados');
      console.error(error);
    } else {
      setTickets(data || []);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    e.dataTransfer.setData('text/plain', ticketId);
    setDraggedTicket(ticketId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('text/plain');
    setDraggedTicket(null);
    setDragOverColumn(null);

    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    // Optimistic update
    setTickets(prev =>
      prev.map(t => (t.id === ticketId ? { ...t, status: newStatus } : t))
    );

    const updateData: Record<string, any> = { status: newStatus as any, updated_at: new Date().toISOString() };
    const { error } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', ticketId);

    if (error) {
      toast.error('Erro ao atualizar status');
      // Revert
      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, status: ticket.status } : t))
      );
    } else {
      toast.success(`Chamado #${ticket.numero} movido para "${KANBAN_COLUMNS.find(c => c.id === newStatus)?.label}"`);
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'critica': return 'bg-[hsl(var(--priority-critica))] text-white';
      case 'alta': return 'bg-[hsl(var(--priority-alta))] text-white';
      case 'media': return 'bg-[hsl(var(--priority-media))] text-white';
      case 'baixa': return 'bg-[hsl(var(--priority-baixa))] text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getColumnTickets = (columnId: string) =>
    tickets.filter(t => t.status === columnId);

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map(col => (
          <div key={col.id} className="min-w-[280px] flex-1">
            <Skeleton className="h-8 w-full mb-3" />
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {KANBAN_COLUMNS.map(column => {
          const columnTickets = getColumnTickets(column.id);
          const isDragOver = dragOverColumn === column.id;

          return (
            <div
              key={column.id}
              className={cn(
                "min-w-[280px] w-[280px] flex-shrink-0 rounded-lg bg-muted/50 transition-colors",
                isDragOver && "bg-accent ring-2 ring-primary/30"
              )}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 p-3 pb-2">
                <div className={cn("h-3 w-3 rounded-full", column.color)} />
                <h3 className="font-semibold text-sm">{column.label}</h3>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {columnTickets.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-[200px]">
                {columnTickets.map(ticket => (
                  <Card
                    key={ticket.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, ticket.id)}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    className={cn(
                      "p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all border",
                      draggedTicket === ticket.id && "opacity-50 scale-95"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-mono text-muted-foreground">#{ticket.numero}</span>
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                      </div>
                    </div>

                    <p className="text-sm font-medium line-clamp-2 mb-2">{ticket.titulo}</p>

                    <div className="flex flex-wrap gap-1 mb-2">
                      <Badge className={cn("text-[10px] px-1.5 py-0", getPriorityColor(ticket.prioridade))}>
                        {ticket.prioridade}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {ticket.companies && (
                        <div className="flex items-center gap-1 truncate">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{ticket.companies.nome_fantasia}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {ticket.profiles?.nome || ticket.solicitante_nome || 'Sem solicitante'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {format(new Date(ticket.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </Card>
                ))}

                {columnTickets.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground border-2 border-dashed rounded-md">
                    Arraste chamados aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
