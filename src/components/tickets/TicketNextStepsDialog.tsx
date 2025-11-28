import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface TicketNextStepsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  ticketNumber: number;
  companyId: string;
  assetId: string;
}

export function TicketNextStepsDialog({
  open,
  onOpenChange,
  ticketId,
  ticketNumber,
  companyId,
  assetId,
}: TicketNextStepsDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creatingService, setCreatingService] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
  const [scheduledTime, setScheduledTime] = useState('09:00');

  const handleImmediateService = async () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (!assetId) {
      toast.error('É necessário vincular um ativo ao chamado antes de criar o atendimento');
      return;
    }

    setCreatingService(true);
    
    try {
      // Buscar dados do ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();
      
      if (ticketError) throw ticketError;
      
      // Criar registro de atendimento diário
      const { data: dailyRecord, error: dailyError } = await supabase
        .from('daily_service_records')
        .insert({
          company_id: companyId,
          tecnico_id: user.id,
          ticket_id: ticketId,
          asset_id: assetId,
          data_atendimento: format(new Date(), 'yyyy-MM-dd'),
          hora_inicio: format(new Date(), 'HH:mm'),
          canal: 'visita_tecnica',
          titulo: ticket.titulo,
          descricao: ticket.descricao,
          status: 'em_andamento',
        })
        .select()
        .single();
      
      if (dailyError) throw dailyError;
      
      // Atualizar status do ticket para "em_atendimento"
      await supabase
        .from('tickets')
        .update({ status: 'em_atendimento' })
        .eq('id', ticketId);
      
      toast.success('Atendimento diário criado com sucesso!');
      
      // Navegar para a página de atendimentos diários com o registro criado
      navigate(`/daily-services?recordId=${dailyRecord.id}`);
      onOpenChange(false);
      
    } catch (error) {
      console.error('Erro ao criar atendimento diário:', error);
      toast.error('Erro ao criar atendimento diário. Tente novamente.');
    } finally {
      setCreatingService(false);
    }
  };

  const handleScheduleService = () => {
    setShowScheduleDialog(true);
  };

  const handleConfirmSchedule = async () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (!assetId) {
      toast.error('É necessário vincular um ativo ao chamado antes de criar a ordem de serviço');
      return;
    }

    setCreatingService(true);
    
    try {
      // Buscar dados do ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();
      
      if (ticketError) throw ticketError;

      // Obter o próximo número de OS
      const { data: maxOS } = await supabase
        .from('service_orders')
        .select('numero_os')
        .order('numero_os', { ascending: false })
        .limit(1)
        .single();

      const numeroOS = (maxOS?.numero_os || 0) + 1;
      
      // Criar ordem de serviço
      const { data: serviceOrder, error: serviceError } = await supabase
        .from('service_orders')
        .insert({
          company_id: companyId,
          asset_id: assetId,
          ticket_id: ticketId,
          tecnico_id: user.id,
          numero_os: numeroOS,
          tipo_servico: 'corretivo',
          prioridade: ticket.prioridade === 'critica' ? 'urgente' : 'media',
          descricao_servicos: ticket.descricao,
          data_agendada: format(scheduledDate, 'yyyy-MM-dd'),
          hora_agendada: scheduledTime,
          status: 'agendada',
        })
        .select()
        .single();
      
      if (serviceError) throw serviceError;
      
      // Atualizar status do ticket
      await supabase
        .from('tickets')
        .update({ status: 'em_atendimento' })
        .eq('id', ticketId);
      
      toast.success('Ordem de serviço agendada com sucesso!');
      navigate(`/service-orders`);
      onOpenChange(false);
      
    } catch (error) {
      console.error('Erro ao criar ordem de serviço:', error);
      toast.error('Erro ao agendar atendimento. Tente novamente.');
    } finally {
      setCreatingService(false);
      setShowScheduleDialog(false);
    }
  };

  const handleViewTicket = () => {
    navigate(`/tickets/${ticketId}`);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chamado #{ticketNumber} criado com sucesso!</DialogTitle>
            <DialogDescription>
              O que você deseja fazer agora?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <Card 
              className="cursor-pointer hover:border-primary transition-colors relative" 
              onClick={creatingService ? undefined : handleImmediateService}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">Atender Agora</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="space-y-2">
                  <p>
                    <strong>Atendimento Imediato</strong>
                  </p>
                  <p className="text-sm">
                    Cria automaticamente um registro de atendimento diário. 
                    Ideal para problemas resolvidos no momento.
                  </p>
                  <ul className="text-xs list-disc list-inside mt-2 space-y-1">
                    <li>Status: Em Atendimento</li>
                    <li>Adicionar solução e fotos</li>
                    <li>Concluir chamado hoje</li>
                  </ul>
                </CardDescription>
              </CardContent>
              {creatingService && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </Card>

            <Card 
              className="cursor-pointer hover:border-primary transition-colors" 
              onClick={creatingService ? undefined : handleScheduleService}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">Agendar Atendimento</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="space-y-2">
                  <p>
                    <strong>Ordem de Serviço Agendada</strong>
                  </p>
                  <p className="text-sm">
                    Cria automaticamente uma ordem de serviço agendada. 
                    Ideal para manutenções preventivas ou atendimentos planejados.
                  </p>
                  <ul className="text-xs list-disc list-inside mt-2 space-y-1">
                    <li>Escolher data e horário</li>
                    <li>Técnico já vinculado</li>
                    <li>Listar equipamentos depois</li>
                  </ul>
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <Button variant="outline" onClick={handleViewTicket} disabled={creatingService}>
              <Clock className="h-4 w-4 mr-2" />
              Decidir Depois
            </Button>
            
            <p className="text-xs text-muted-foreground">
              Você pode agendar ou atender depois pela página do chamado
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de agendamento */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Atendimento</DialogTitle>
            <DialogDescription>
              Escolha a data e horário para o atendimento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data do Agendamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(scheduledDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={(date) => date && setScheduledDate(date)}
                    locale={ptBR}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowScheduleDialog(false)}
              disabled={creatingService}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmSchedule}
              disabled={creatingService}
            >
              {creatingService && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
