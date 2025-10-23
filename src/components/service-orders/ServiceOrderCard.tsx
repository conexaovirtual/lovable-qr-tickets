import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateServiceOrderPDF } from './ServiceOrderPDF';

interface ServiceOrderCardProps {
  serviceOrder: any;
  onViewDetails?: (serviceOrder: any) => void;
}

const statusColors = {
  agendada: 'bg-blue-500',
  confirmada: 'bg-green-500',
  em_execucao: 'bg-yellow-500',
  executada: 'bg-purple-500',
  finalizada: 'bg-gray-700',
  cancelada: 'bg-red-500',
};

const statusLabels = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  em_execucao: 'Em Execução',
  executada: 'Executada',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};

export function ServiceOrderCard({ serviceOrder, onViewDetails }: ServiceOrderCardProps) {
  const handleDownload = () => {
    generateServiceOrderPDF(serviceOrder);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              OS #{serviceOrder.numero_os}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Chamado #{serviceOrder.tickets?.numero}
            </p>
          </div>
          <Badge className={statusColors[serviceOrder.status as keyof typeof statusColors]}>
            {statusLabels[serviceOrder.status as keyof typeof statusLabels]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium">Cliente</p>
          <p className="text-sm text-muted-foreground">
            {serviceOrder.companies?.nome_fantasia}
          </p>
        </div>

        <div>
          <p className="text-sm font-medium">Técnico</p>
          <p className="text-sm text-muted-foreground">
            {serviceOrder.profiles?.nome || 'N/A'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium">Data Agendada</p>
            <p className="text-sm text-muted-foreground">
              {serviceOrder.data_agendada 
                ? format(new Date(serviceOrder.data_agendada), 'dd/MM/yyyy', { locale: ptBR })
                : 'N/A'}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium">Hora</p>
            <p className="text-sm text-muted-foreground">
              {serviceOrder.hora_agendada?.slice(0, 5) || 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            onClick={() => onViewDetails?.(serviceOrder)} 
            className="flex-1"
            variant="default"
          >
            <FileText className="h-4 w-4 mr-2" />
            Ver Detalhes
          </Button>
          <Button 
            onClick={handleDownload} 
            className="flex-1"
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
