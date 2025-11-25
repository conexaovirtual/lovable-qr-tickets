import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, AlertCircle, Phone, MessageSquare, MapPin, QrCode, Building2, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketCardProps {
  ticket: any;
}

export const TicketCard = memo(({ ticket }: TicketCardProps) => {
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

  const getCanalIcon = () => {
    switch (ticket.canal) {
      case 'whatsapp':
        return <MessageSquare className="h-3 w-3" />;
      case 'ligacao':
        return <Phone className="h-3 w-3" />;
      case 'visita_tecnica':
        return <MapPin className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getCanalLabel = () => {
    switch (ticket.canal) {
      case 'whatsapp':
        return 'WhatsApp';
      case 'ligacao':
        return 'Telefone';
      case 'visita_tecnica':
        return 'Visita';
      case 'email':
        return 'E-mail';
      case 'web':
        return 'Web';
      default:
        return ticket.canal;
    }
  };

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${ticket.public_request && ticket.status === 'novo' ? 'border-destructive border-2' : ''}`}
      onClick={() => navigate(`/tickets/${ticket.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-mono text-muted-foreground">#{ticket.numero}</span>
              <Badge variant={ticket.status as any}>{ticket.status.replace(/_/g, ' ')}</Badge>
              <Badge variant={ticket.prioridade as any}>{ticket.prioridade}</Badge>
              {ticket.public_request && (
                <Badge variant="destructive" className="gap-1">
                  <QrCode className="h-3 w-3" />
                  QR Code
                </Badge>
              )}
              {ticket.canal && (
                <Badge variant="outline" className="gap-1">
                  {getCanalIcon()}
                  {getCanalLabel()}
                </Badge>
              )}
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
          {ticket.public_request ? (
            <>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {ticket.solicitante_nome || 'Solicitante externo'}
              </div>
              {ticket.solicitante_contato && (
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {ticket.solicitante_contato}
                </div>
              )}
              {ticket.companies && (
                <div className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {ticket.companies.nome_fantasia}
                </div>
              )}
              {ticket.assets && (
                <div className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  {ticket.assets.nome || ticket.assets.tipo}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {ticket.profiles_safe?.nome || ticket.profiles?.nome || 'Sem solicitante'}
              </div>
            </>
          )}
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
});
