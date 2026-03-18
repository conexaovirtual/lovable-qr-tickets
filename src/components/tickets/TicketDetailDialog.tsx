import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, User, Package, AlertCircle, ExternalLink, Building2 } from 'lucide-react';
import { TicketImpactIndicator } from './TicketImpactIndicator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
}

export function TicketDetailDialog({ open, onOpenChange, ticketId }: TicketDetailDialogProps) {
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && ticketId) {
      loadTicket();
    } else {
      setTicket(null);
    }
  }, [open, ticketId]);

  const loadTicket = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          companies:company_id(nome_fantasia),
          categories(nome, cor),
          subcategories(nome),
          assets(tipo, tag_patrimonial, numero_serie, fabricante, modelo),
          tecnico:profiles!tickets_tecnico_id_fkey(nome)
        `)
        .eq('id', ticketId)
        .single();

      if (error) {
        console.error('Erro ao carregar chamado:', error);
      }
      if (data) setTicket(data);
    } catch (err) {
      console.error('Erro inesperado ao carregar chamado:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSLAStatus = () => {
    if (!ticket?.sla_solucao_limite) return null;
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Detalhes do Chamado
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : ticket ? (
          <div className="space-y-4 mt-4">
            {/* Header info */}
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-sm font-mono text-muted-foreground">#{ticket.numero}</span>
                <Badge variant={ticket.status as any}>{ticket.status?.replace(/_/g, ' ')}</Badge>
                <Badge variant={ticket.prioridade as any}>{ticket.prioridade}</Badge>
                {ticket.public_request && (
                  <Badge variant="outline" className="text-xs">QR Code</Badge>
                )}
              </div>
              <h3 className="text-lg font-semibold">{ticket.titulo}</h3>
              {slaStatus && (
                <Badge variant={slaStatus.color as any} className="mt-2">
                  <Clock className="h-3 w-3 mr-1" />
                  {slaStatus.text}
                </Badge>
              )}
            </div>

            {/* Descrição */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Descrição</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{ticket.descricao}</p>
              </CardContent>
            </Card>

            {/* Solução */}
            {ticket.solucao && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Solução</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{ticket.solucao}</p>
                </CardContent>
              </Card>
            )}

            {/* Informações */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {ticket.companies && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{ticket.companies.nome_fantasia}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{ticket.solicitante_nome || 'N/A'}</span>
                </div>

                {ticket.tecnico && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Técnico: {ticket.tecnico.nome}</span>
                  </div>
                )}

                {ticket.categories && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span>{ticket.categories.nome}</span>
                    {ticket.subcategories && (
                      <span className="text-muted-foreground">/ {ticket.subcategories.nome}</span>
                    )}
                  </div>
                )}

                {ticket.assets && (
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>{ticket.assets.tipo} - {ticket.assets.fabricante} {ticket.assets.modelo}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Impact indicator */}
            {ticket.asset_id && <TicketImpactIndicator assetId={ticket.asset_id} />}

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                  <div>
                    <p className="text-muted-foreground">Impacto</p>
                    <p className="font-medium capitalize">{ticket.impacto || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Urgência</p>
                    <p className="font-medium capitalize">{ticket.urgencia || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Canal</p>
                    <p className="font-medium capitalize">{ticket.canal || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botão para abrir completo */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                navigate(`/tickets/${ticket.id}`);
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir Chamado Completo
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-center mt-8">Chamado não encontrado</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
