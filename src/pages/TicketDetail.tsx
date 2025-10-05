import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Clock, User, Package, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TicketTimeline } from '@/components/tickets/TicketTimeline';
import { TicketComments } from '@/components/tickets/TicketComments';
import { TicketStatusUpdate } from '@/components/tickets/TicketStatusUpdate';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTicket();
  }, [id]);

  const loadTicket = async () => {
    if (!id) return;

    setLoading(true);
    const { data } = await supabase
      .from('tickets')
      .select(`
        *,
        categories(nome, cor),
        subcategories(nome),
        assets(tipo, tag_patrimonial, numero_serie, fabricante, modelo),
        profiles!tickets_solicitante_id_fkey(nome, telefone),
        tecnico:profiles!tickets_tecnico_id_fkey(nome)
      `)
      .eq('id', id)
      .single();

    if (data) setTicket(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 max-w-5xl">
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Chamado não encontrado</p>
          <Button onClick={() => navigate('/tickets')}>Voltar para Chamados</Button>
        </div>
      </div>
    );
  }

  const canManage = profile?.role && ['admin_provedor', 'tecnico', 'gestor_cliente'].includes(profile.role);

  const getSLAStatus = () => {
    if (!ticket.sla_solucao_limite) return null;
    
    const now = new Date();
    const limite = new Date(ticket.sla_solucao_limite);
    const diff = limite.getTime() - now.getTime();
    const hoursLeft = diff / (1000 * 60 * 60);

    if (diff < 0) return { color: 'destructive', text: 'SLA violado', hours: Math.abs(hoursLeft) };
    if (hoursLeft < 2) return { color: 'warning', text: 'SLA em risco', hours: hoursLeft };
    return { color: 'success', text: 'SLA em dia', hours: hoursLeft };
  };

  const slaStatus = getSLAStatus();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/tickets')} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-mono text-muted-foreground">#{ticket.numero}</span>
                <Badge variant={ticket.status as any}>{ticket.status.replace(/_/g, ' ')}</Badge>
                <Badge variant={ticket.prioridade as any}>{ticket.prioridade}</Badge>
              </div>
              <h1 className="text-2xl font-bold">{ticket.titulo}</h1>
            </div>
            {slaStatus && (
              <Badge variant={slaStatus.color as any} className="text-sm">
                <Clock className="h-4 w-4 mr-1" />
                {slaStatus.text} ({Math.round(slaStatus.hours)}h)
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Descrição</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{ticket.descricao}</p>
              </CardContent>
            </Card>

            {ticket.solucao && (
              <Card>
                <CardHeader>
                  <CardTitle>Solução</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{ticket.solucao}</p>
                </CardContent>
              </Card>
            )}

            <TicketTimeline ticketId={ticket.id} />
            <TicketComments ticketId={ticket.id} />
          </div>

          <div className="space-y-4">
            {canManage && (
              <TicketStatusUpdate ticket={ticket} onUpdate={loadTicket} />
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Solicitante</p>
                    <p className="font-medium">{ticket.profiles?.nome}</p>
                    {ticket.profiles?.telefone && (
                      <p className="text-xs text-muted-foreground">{ticket.profiles.telefone}</p>
                    )}
                  </div>
                </div>

                {ticket.tecnico && (
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Técnico</p>
                      <p className="font-medium">{ticket.tecnico.nome}</p>
                    </div>
                  </div>
                )}

                {ticket.categories && (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Categoria</p>
                      <p className="font-medium">{ticket.categories.nome}</p>
                      {ticket.subcategories && (
                        <p className="text-xs text-muted-foreground">{ticket.subcategories.nome}</p>
                      )}
                    </div>
                  </div>
                )}

                {ticket.assets && (
                  <div className="flex items-start gap-2">
                    <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Ativo</p>
                      <p className="font-medium">{ticket.assets.tipo}</p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.assets.fabricante} {ticket.assets.modelo}
                      </p>
                      <p className="text-xs font-mono">{ticket.assets.tag_patrimonial || ticket.assets.numero_serie}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Criado em</p>
                    <p className="font-medium">
                      {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Impacto</p>
                      <p className="font-medium capitalize">{ticket.impacto}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Urgência</p>
                      <p className="font-medium capitalize">{ticket.urgencia}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Canal</p>
                      <p className="font-medium capitalize">{ticket.canal}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
