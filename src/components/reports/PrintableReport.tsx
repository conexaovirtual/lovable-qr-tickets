import { Building2, Package, Ticket } from 'lucide-react';

interface PrintableReportProps {
  data: {
    companies: any[];
    period: { start: string; end: string };
    options: {
      includeAssets: boolean;
      includeTickets: boolean;
      includeStats: boolean;
    };
  };
}

export function PrintableReport({ data }: PrintableReportProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  if (!data?.companies || data.companies.length === 0) {
    return (
      <div className="hidden print:block fixed inset-0 bg-white z-50 p-8">
        <div className="text-center py-8">
          <p className="text-lg text-muted-foreground">Nenhum dado disponível para impressão.</p>
        </div>
      </div>
    );
  }

  return (
    <div id="printable-report" className="hidden print:block fixed inset-0 bg-white z-50 overflow-auto">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 1.5cm;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          /* Esconder tudo exceto o relatório */
          body * {
            visibility: hidden;
          }
          
          #printable-report,
          #printable-report * {
            visibility: visible;
          }
          
          #printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          
          .page-break {
            page-break-after: always;
          }
          
          .avoid-break {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="p-8 max-w-[210mm] mx-auto">
        {/* Header */}
        <header className="border-b-2 border-primary pb-4 mb-6 avoid-break">
          <h1 className="text-3xl font-bold text-primary mb-2">Help Desk TI</h1>
          <h2 className="text-xl font-semibold mb-2">Relatório de Empresas e Chamados</h2>
          <div className="text-sm text-muted-foreground">
            <p>Período: {formatDate(data.period.start)} a {formatDate(data.period.end)}</p>
            <p>Gerado em: {new Date().toLocaleString('pt-BR')}</p>
          </div>
        </header>

        {/* Companies Report */}
        {data.companies.map((company, index) => (
          <div key={company.company_id} className={index > 0 ? 'page-break' : ''}>
            <section className="mb-8">
              {/* Company Header */}
              <div className="bg-primary/5 p-4 rounded-lg mb-4 avoid-break">
                <div className="flex items-start gap-3">
                  <Building2 className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="text-xl font-bold">{company.nome_fantasia}</h3>
                    {company.cnpj && (
                      <p className="text-sm text-muted-foreground">CNPJ: {company.cnpj}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Overview */}
              {data.options.includeStats && (
                <div className="grid grid-cols-2 gap-4 mb-6 avoid-break">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold">Ativos</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="text-lg font-bold">{company.total_ativos || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Em uso</p>
                        <p className="text-lg font-bold">{company.ativos_em_uso || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Manutenção</p>
                        <p className="text-lg font-bold">{company.ativos_manutencao || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Estoque</p>
                        <p className="text-lg font-bold">{company.ativos_estoque || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Ticket className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold">Chamados</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="text-lg font-bold">{company.total_tickets || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Novos</p>
                        <p className="text-lg font-bold">{company.tickets_novos || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Em atendimento</p>
                        <p className="text-lg font-bold">{company.tickets_em_atendimento || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Resolvidos</p>
                        <p className="text-lg font-bold">{company.tickets_resolvidos || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Metrics */}
              {data.options.includeStats && (
                <div className="border rounded-lg p-4 mb-6 avoid-break">
                  <h4 className="font-semibold mb-3">Métricas de Performance</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Taxa de Resolução</p>
                      <p className="text-lg font-bold">
                        {company.total_tickets > 0
                          ? Math.round((company.tickets_resolvidos / company.total_tickets) * 100)
                          : 0}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">SLA Cumprido</p>
                      <p className="text-lg font-bold">
                        {company.total_tickets > 0
                          ? Math.round(((company.total_tickets - (company.tickets_sla_violado || 0)) / company.total_tickets) * 100)
                          : 100}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tempo Médio Resolução</p>
                      <p className="text-lg font-bold">
                        {company.tempo_medio_resolucao_horas 
                          ? `${Math.round(company.tempo_medio_resolucao_horas)}h`
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SLA Configuration */}
              <div className="border rounded-lg p-4 avoid-break">
                <h4 className="font-semibold mb-3">Configuração de SLA</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Primeiro Atendimento</p>
                    <p className="font-semibold">{company.sla_primeiro_atendimento_horas}h</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Solução</p>
                    <p className="font-semibold">{company.sla_solucao_horas}h</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ))}

        {/* Footer */}
        <footer className="border-t-2 border-primary pt-4 mt-8 text-sm text-muted-foreground avoid-break">
          <p>Este relatório foi gerado automaticamente pelo sistema Help Desk TI</p>
          <p>© {new Date().getFullYear()} - Todos os direitos reservados</p>
        </footer>
      </div>
    </div>
  );
}
