import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateServiceOrderPDF } from './ServiceOrderPDF';

interface ServiceOrderCardProps {
  serviceOrder: any;
}

const statusColors = {
  emitida: 'bg-blue-500',
  executada: 'bg-green-500',
  cancelada: 'bg-red-500',
};

const statusLabels = {
  emitida: 'Emitida',
  executada: 'Executada',
  cancelada: 'Cancelada',
};

export function ServiceOrderCard({ serviceOrder }: ServiceOrderCardProps) {
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
            <p className="text-sm font-medium">Data de Execução</p>
            <p className="text-sm text-muted-foreground">
              {serviceOrder.data_execucao 
                ? format(new Date(serviceOrder.data_execucao), 'dd/MM/yyyy', { locale: ptBR })
                : 'N/A'}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium">Custo Total</p>
            <p className="text-sm font-semibold text-primary">
              R$ {serviceOrder.custo_total?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>

        <Button 
          onClick={handleDownload} 
          className="w-full mt-4"
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          Baixar PDF
        </Button>
      </CardContent>
    </Card>
  );
}
