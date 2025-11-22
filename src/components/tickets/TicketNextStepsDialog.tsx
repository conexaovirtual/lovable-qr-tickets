import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

  const handleImmediateService = () => {
    navigate(`/tickets/${ticketId}`);
    onOpenChange(false);
  };

  const handleScheduleService = () => {
    navigate(`/service-orders/new?ticketId=${ticketId}&companyId=${companyId}&assetId=${assetId}`);
    onOpenChange(false);
  };

  const handleViewTicket = () => {
    navigate(`/tickets/${ticketId}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chamado #{ticketNumber} criado com sucesso!</DialogTitle>
          <DialogDescription>
            O que você deseja fazer agora?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={handleImmediateService}>
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
                  Registre a solução e conclua o atendimento imediatamente. 
                  Ideal para problemas resolvidos no momento.
                </p>
                <ul className="text-xs list-disc list-inside mt-2 space-y-1">
                  <li>Status: Em Atendimento</li>
                  <li>Adicionar solução e fotos</li>
                  <li>Concluir chamado hoje</li>
                </ul>
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={handleScheduleService}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Agendar Atendimento</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="space-y-2">
                <p>
                  <strong>Ordem de Serviço Agendada</strong>
                </p>
                <p className="text-sm">
                  Agende a execução para uma data futura. 
                  Ideal para manutenções preventivas ou atendimentos planejados.
                </p>
                <ul className="text-xs list-disc list-inside mt-2 space-y-1">
                  <li>Escolher data e horário</li>
                  <li>Definir técnico responsável</li>
                  <li>Listar equipamentos necessários</li>
                </ul>
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={handleViewTicket}>
            <Clock className="h-4 w-4 mr-2" />
            Decidir Depois
          </Button>
          
          <p className="text-xs text-muted-foreground">
            Você pode agendar ou atender depois pela página do chamado
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
