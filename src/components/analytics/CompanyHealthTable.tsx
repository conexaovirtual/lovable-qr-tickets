import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CompanyHealth } from '@/hooks/useAnalyticsData';
import { HealthScoreIndicator } from './HealthScoreIndicator';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface CompanyHealthTableProps {
  companies: CompanyHealth[];
  title?: string;
  showAll?: boolean;
}

export function CompanyHealthTable({ companies, title = 'Saúde das Empresas', showAll = false }: CompanyHealthTableProps) {
  const navigate = useNavigate();
  const displayCompanies = showAll ? companies : companies.slice(0, 10);

  const getTrendIcon = (tendencia: CompanyHealth['tendencia']) => {
    switch (tendencia) {
      case 'aumentando':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'diminuindo':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendLabel = (tendencia: CompanyHealth['tendencia']) => {
    switch (tendencia) {
      case 'aumentando':
        return 'Aumentando';
      case 'diminuindo':
        return 'Diminuindo';
      default:
        return 'Estável';
    }
  };

  const getDaysBadgeVariant = (dias: number) => {
    if (dias >= 60) return 'destructive';
    if (dias >= 30) return 'secondary';
    return 'outline';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {displayCompanies.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma empresa encontrada
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-center">Saúde</TableHead>
                <TableHead className="text-center">Abertos</TableHead>
                <TableHead className="text-center">Dias s/ Visita</TableHead>
                <TableHead className="text-center">Tendência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayCompanies.map((company) => (
                <TableRow 
                  key={company.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/companies/${company.id}`)}
                >
                  <TableCell className="font-medium">
                    {company.nome_fantasia}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <HealthScoreIndicator score={company.health_score} size="sm" showLabel={false} />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={company.tickets_abertos > 0 ? 'destructive' : 'outline'}>
                      {company.tickets_abertos}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getDaysBadgeVariant(company.dias_sem_visita)}>
                      {company.dias_sem_visita === 999 ? 'Nunca' : `${company.dias_sem_visita}d`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {getTrendIcon(company.tendencia)}
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {getTrendLabel(company.tendencia)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
