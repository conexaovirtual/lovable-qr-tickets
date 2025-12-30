import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, CheckCircle2, Clock, Loader2, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface PublicTicketActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  ticketNumber: number;
  companyId: string;
  assetId: string;
  ticketTitle: string;
  ticketDescription: string;
}

interface Technician {
  id: string;
  nome: string;
}

export function PublicTicketActionsDialog({
  open,
  onOpenChange,
  ticketId,
  ticketNumber,
  companyId,
  assetId,
  ticketTitle,
  ticketDescription,
}: PublicTicketActionsDialogProps) {
  const [creatingService, setCreatingService] = useState(false);
  const [actionType, setActionType] = useState<'immediate' | 'schedule' | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechnician, setSelectedTechnician] = useState<string>('');
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [canal, setCanal] = useState<'whatsapp' | 'ligacao' | 'visita_tecnica'>('visita_tecnica');

  useEffect(() => {
    if (open) {
      loadTechnicians();
    }
  }, [open]);

  const loadTechnicians = async () => {
    setLoadingTechnicians(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          profiles!inner(id, nome)
        `)
        .eq('role', 'tecnico');

      if (error) throw error;

      const techs = data?.map((item: any) => ({
        id: item.profiles.id,
        nome: item.profiles.nome,
      })) || [];

      // Remove duplicates
      const uniqueTechs = techs.filter((tech, index, self) => 
        index === self.findIndex(t => t.id === tech.id)
      );

      setTechnicians(uniqueTechs);
    } catch (error) {
      console.error('Erro ao carregar técnicos:', error);
    } finally {
      setLoadingTechnicians(false);
    }
  };

  const handleImmediateService = async () => {
    if (!selectedTechnician) {
      toast.error('Selecione um técnico para o atendimento');
      return;
    }

    setCreatingService(true);
    
    try {
      // Usar a data local corretamente
      const now = new Date();
      const localDate = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const localTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

      // Criar registro de atendimento diário
      const { error: dailyError } = await supabase
        .from('daily_service_records')
        .insert({
          company_id: companyId,
          tecnico_id: selectedTechnician,
          ticket_id: ticketId,
          asset_id: assetId,
          data_atendimento: localDate,
          hora_inicio: localTime,
          canal: canal,
          titulo: ticketTitle,
          descricao: ticketDescription,
          status: 'em_andamento',
        });
      
      if (dailyError) throw dailyError;
      
      // Atualizar status do ticket para "em_atendimento" e vincular técnico
      await supabase
        .from('tickets')
        .update({ 
          status: 'em_atendimento',
          tecnico_id: selectedTechnician,
        })
        .eq('id', ticketId);
      
      toast.success('Atendimento criado com sucesso!');
      onOpenChange(false);
      
    } catch (error) {
      console.error('Erro ao criar atendimento:', error);
      toast.error('Erro ao criar atendimento. Tente novamente.');
    } finally {
      setCreatingService(false);
    }
  };

  const handleScheduleService = async () => {
    if (!selectedTechnician) {
      toast.error('Selecione um técnico para a ordem de serviço');
      return;
    }

    setCreatingService(true);
    
    try {
      // Obter o próximo número de OS
      const { data: maxOS } = await supabase
        .from('service_orders')
        .select('numero_os')
        .order('numero_os', { ascending: false })
        .limit(1)
        .single();

      const numeroOS = (maxOS?.numero_os || 0) + 1;
      
      // Criar ordem de serviço
      const { error: serviceError } = await supabase
        .from('service_orders')
        .insert({
          company_id: companyId,
          asset_id: assetId,
          ticket_id: ticketId,
          tecnico_id: selectedTechnician,
          numero_os: numeroOS,
          tipo_servico: 'corretivo',
          prioridade: 'media',
          descricao_servicos: ticketDescription,
          data_agendada: format(scheduledDate, 'yyyy-MM-dd'),
          hora_agendada: scheduledTime,
          status: 'agendada',
        });
      
      if (serviceError) throw serviceError;
      
      // Atualizar status do ticket e vincular técnico
      await supabase
        .from('tickets')
        .update({ 
          status: 'em_atendimento',
          tecnico_id: selectedTechnician,
        })
        .eq('id', ticketId);
      
      toast.success('Ordem de serviço agendada com sucesso!');
      onOpenChange(false);
      
    } catch (error) {
      console.error('Erro ao criar ordem de serviço:', error);
      toast.error('Erro ao agendar atendimento. Tente novamente.');
    } finally {
      setCreatingService(false);
    }
  };

  const handleClose = () => {
    setActionType(null);
    setSelectedTechnician('');
    onOpenChange(false);
  };

  const renderMainOptions = () => (
    <>
      <DialogHeader>
        <DialogTitle>Chamado #{ticketNumber} criado com sucesso!</DialogTitle>
        <DialogDescription>
          Escolha uma opção para dar continuidade ao atendimento
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
        <Card 
          className="cursor-pointer hover:border-primary transition-colors" 
          onClick={() => setActionType('immediate')}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Abrir Atendimento</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="space-y-2">
              <p><strong>Atendimento Imediato</strong></p>
              <p className="text-sm">
                Cria um registro de atendimento diário para acompanhamento.
              </p>
              <ul className="text-xs list-disc list-inside mt-2 space-y-1">
                <li>Selecionar técnico responsável</li>
                <li>Definir canal de atendimento</li>
                <li>Acompanhar solução</li>
              </ul>
            </CardDescription>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary transition-colors" 
          onClick={() => setActionType('schedule')}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Agendar Serviço</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="space-y-2">
              <p><strong>Ordem de Serviço</strong></p>
              <p className="text-sm">
                Agenda uma visita técnica para data e horário específicos.
              </p>
              <ul className="text-xs list-disc list-inside mt-2 space-y-1">
                <li>Escolher data e horário</li>
                <li>Designar técnico</li>
                <li>Planejamento antecipado</li>
              </ul>
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center pt-4 border-t">
        <Button variant="outline" onClick={handleClose}>
          Fechar
        </Button>
      </div>
    </>
  );

  const renderImmediateForm = () => (
    <>
      <DialogHeader>
        <DialogTitle>Abrir Atendimento</DialogTitle>
        <DialogDescription>
          Selecione o técnico e o canal de atendimento
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Técnico Responsável *
          </Label>
          <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
            <SelectTrigger>
              <SelectValue placeholder={loadingTechnicians ? "Carregando..." : "Selecione um técnico"} />
            </SelectTrigger>
            <SelectContent>
              {technicians.map((tech) => (
                <SelectItem key={tech.id} value={tech.id}>
                  {tech.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Canal de Atendimento</Label>
          <RadioGroup value={canal} onValueChange={(value: any) => setCanal(value)} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="visita_tecnica" id="visita" />
              <Label htmlFor="visita" className="cursor-pointer">Visita Técnica</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="whatsapp" id="whatsapp" />
              <Label htmlFor="whatsapp" className="cursor-pointer">WhatsApp</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ligacao" id="ligacao" />
              <Label htmlFor="ligacao" className="cursor-pointer">Ligação</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => setActionType(null)} disabled={creatingService}>
          Voltar
        </Button>
        <Button onClick={handleImmediateService} disabled={creatingService || !selectedTechnician}>
          {creatingService && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar Atendimento
        </Button>
      </DialogFooter>
    </>
  );

  const renderScheduleForm = () => (
    <>
      <DialogHeader>
        <DialogTitle>Agendar Ordem de Serviço</DialogTitle>
        <DialogDescription>
          Escolha o técnico, data e horário para o atendimento
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Técnico Responsável *
          </Label>
          <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
            <SelectTrigger>
              <SelectValue placeholder={loadingTechnicians ? "Carregando..." : "Selecione um técnico"} />
            </SelectTrigger>
            <SelectContent>
              {technicians.map((tech) => (
                <SelectItem key={tech.id} value={tech.id}>
                  {tech.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
        <Button variant="outline" onClick={() => setActionType(null)} disabled={creatingService}>
          Voltar
        </Button>
        <Button onClick={handleScheduleService} disabled={creatingService || !selectedTechnician}>
          {creatingService && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirmar Agendamento
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        {actionType === null && renderMainOptions()}
        {actionType === 'immediate' && renderImmediateForm()}
        {actionType === 'schedule' && renderScheduleForm()}
      </DialogContent>
    </Dialog>
  );
}
