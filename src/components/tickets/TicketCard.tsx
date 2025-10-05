import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketCardProps {
  ticket: any;
}

export function TicketCard({ ticket }: TicketCardProps) {
  const navigate = useNavigate();

  const getSLAStatus = () => {
    if (!ticket.sla_solucao_limite) return null;
    
    const now = new Date();
    const limite = new Date(ticket.sla_solucao_limite);
    const diff = limite.getTime() - now.getTime();
    const hoursLeft = diff / (1000 * 60 * 60);

    if (diff < 0) return { color: 'destructive', text: 'SLA violado' };
    if (hoursLeft < 2) return { color: 'warning', text: 'SLA em risco' };
    return { color: 'success', text: 'SLA em dia' };
  };

  const slaStatus = getSLAStatus();

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/tickets/${ticket.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-muted-foreground">#{ticket.numero}</span>
              <Badge variant={ticket.status as any}>{ticket.status.replace(/_/g, ' ')}</Badge>
              <Badge variant={ticket.prioridade as any}>{ticket.prioridade}</Badge>
            </div>
            <h3 className="font-semibold truncate">{ticket.titulo}</h3>
          </div>
          {slaStatus && (
            <Badge variant={slaStatus.color as any} className="shrink-0">
              <Clock className="h-3 w-3 mr-1" />
              {slaStatus.text}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {ticket.profiles?.nome || 'Sem solicitante'}
          </div>
          {ticket.categories && (
            <div className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {ticket.categories.nome}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>
        {ticket.descricao && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{ticket.descricao}</p>
        )}
      </CardContent>
    </Card>
  );
}
