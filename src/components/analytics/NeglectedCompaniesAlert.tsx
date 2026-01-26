import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CompanyHealth } from '@/hooks/useAnalyticsData';
import { AlertTriangle, Calendar, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateBR } from '@/lib/formatters';

interface NeglectedCompaniesAlertProps {
  companies: CompanyHealth[];
  onCreateMaintenance?: (companyId: string) => void;
}

export function NeglectedCompaniesAlert({ companies, onCreateMaintenance }: NeglectedCompaniesAlertProps) {
  const navigate = useNavigate();

  if (companies.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            <CardTitle className="text-base text-green-800 dark:text-green-400">
              Todos os Clientes em Dia
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-700 dark:text-green-300">
            Nenhuma empresa está há mais de 30 dias sem visita. Excelente trabalho!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base text-destructive">
              Clientes Negligenciados
            </CardTitle>
          </div>
          <Badge variant="destructive">
            {companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Estas empresas estão há mais de 30 dias sem receber atendimento presencial ou remoto:
        </p>
        
        <div className="space-y-2">
          {companies.slice(0, 5).map((company) => (
            <div 
              key={company.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/companies/${company.id}`)}
            >
              <div className="flex-1">
                <p className="font-medium text-sm">{company.nome_fantasia}</p>
                <p className="text-xs text-muted-foreground">
                  {company.ultimo_atendimento 
                    ? `Último atendimento: ${formatDateBR(company.ultimo_atendimento)}`
                    : 'Nunca recebeu atendimento'
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="whitespace-nowrap">
                  {company.dias_sem_visita === 999 ? 'Nunca visitado' : `${company.dias_sem_visita} dias`}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>

        {companies.length > 5 && (
          <p className="text-sm text-muted-foreground mt-3 text-center">
            E mais {companies.length - 5} empresas...
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => navigate('/companies')}
          >
            Ver Todas Empresas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
