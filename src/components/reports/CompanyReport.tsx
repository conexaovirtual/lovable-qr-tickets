import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  ChevronUp, 
  Building2, 
  Package, 
  Ticket, 
  TrendingUp, 
  Clock, 
  Star,
  AlertCircle 
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface CompanyReportProps {
  report: any;
}

export function CompanyReport({ report }: CompanyReportProps) {
  const [expanded, setExpanded] = useState(false);

  const ticketResolutionRate = report.total_tickets > 0
    ? ((report.tickets_resolvidos + report.tickets_fechados) / report.total_tickets) * 100
    : 0;

  const slaComplianceRate = report.total_tickets > 0
    ? ((report.total_tickets - report.tickets_sla_violado) / report.total_tickets) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-xl">{report.nome_fantasia}</CardTitle>
                {report.cnpj && (
                  <p className="text-sm text-muted-foreground mt-1">
                    CNPJ: {report.cnpj}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {report.status ? (
              <Badge variant="default">Ativa</Badge>
            ) : (
              <Badge variant="secondary">Inativa</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{report.total_ativos || 0}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded">
              <Ticket className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{report.total_tickets || 0}</p>
              <p className="text-xs text-muted-foreground">Chamados</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-500/10 rounded">
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ticketResolutionRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Resolvidos</p>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="space-y-6 pt-4 border-t">
            {/* Assets Breakdown */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Ativos por Status
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Em uso</span>
                  <Badge variant="outline">{report.ativos_em_uso || 0}</Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Manutenção</span>
                  <Badge variant="outline">{report.ativos_manutencao || 0}</Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Estoque</span>
                  <Badge variant="outline">{report.ativos_estoque || 0}</Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Baixados</span>
                  <Badge variant="outline">{report.ativos_baixados || 0}</Badge>
                </div>
              </div>
            </div>

            {/* Tickets Breakdown */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                Chamados por Status
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Novos</span>
                  <Badge variant="outline">{report.tickets_novos || 0}</Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Em Atendimento</span>
                  <Badge variant="outline">{report.tickets_em_atendimento || 0}</Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Resolvidos</span>
                  <Badge variant="outline">{report.tickets_resolvidos || 0}</Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Fechados</span>
                  <Badge variant="outline">{report.tickets_fechados || 0}</Badge>
                </div>
              </div>
            </div>

            {/* SLA & Performance */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Conformidade SLA
                  </span>
                  <span className="text-sm font-bold">{slaComplianceRate.toFixed(1)}%</span>
                </div>
                <Progress value={slaComplianceRate} className="h-2" />
                {report.tickets_sla_violado > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {report.tickets_sla_violado} chamado(s) fora do SLA
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {report.tempo_medio_resolucao_horas !== null && (
                  <div className="p-3 bg-muted/50 rounded">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Tempo Médio de Resolução
                    </p>
                    <p className="text-lg font-bold">
                      {report.tempo_medio_resolucao_horas.toFixed(1)}h
                    </p>
                  </div>
                )}

                {report.media_avaliacao !== null && (
                  <div className="p-3 bg-muted/50 rounded">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      Avaliação Média
                    </p>
                    <p className="text-lg font-bold">
                      {report.media_avaliacao.toFixed(1)} / 5.0
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SLA Configuration */}
            <div className="pt-3 border-t">
              <h4 className="font-semibold mb-2 text-sm">Configuração de SLA</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Primeiro Atendimento:</span>
                  <span className="font-medium">{report.sla_primeiro_atendimento_horas}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solução:</span>
                  <span className="font-medium">{report.sla_solucao_horas}h</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
