import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CompanyReportList } from '@/components/reports/CompanyReportList';
import { ReportPrintDialog } from '@/components/reports/ReportPrintDialog';
import { InventoryReport } from '@/components/reports/InventoryReport';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileBarChart, Building2, Package, Ticket, Printer, FileText, Calendar as CalendarIcon, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ServiceOrderList } from '@/components/service-orders/ServiceOrderList';
import { ServiceOrderCalendar } from '@/components/service-orders/ServiceOrderCalendar';
import { DailyServicesReport } from '@/components/reports/DailyServicesReport';
import { PageHeader } from '@/components/layout/PageHeader';

export default function Reports() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState<any[]>([]);
  const [stats, setStats] = useState({ companies: 0, assets: 0, tickets: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const defaultTab = searchParams.get('tab') || 'overview';
  const statusFilter = searchParams.get('status');

  useEffect(() => {
    if (!loading && !profile) { navigate('/auth'); return; }
    const canAccess = profile?.roles?.includes('admin_provedor') || profile?.roles?.includes('gestor_cliente') || profile?.roles?.includes('tecnico');
    if (profile && !canAccess) { navigate('/dashboard'); toast.error('Acesso negado'); return; }
    if (profile) loadReports();
  }, [profile, loading, navigate]);

  const loadReports = async () => {
    try {
      setLoadingData(true);
      const { data, error } = await supabase.from('company_statistics').select('*').order('nome_fantasia');
      if (error) throw error;
      setReports(data || []);
      const totals = (data || []).reduce((acc, curr) => ({
        companies: acc.companies + 1, assets: acc.assets + (curr.total_ativos || 0), tickets: acc.tickets + (curr.total_tickets || 0),
      }), { companies: 0, assets: 0, tickets: 0 });
      setStats(totals);
    } catch (error: any) { toast.error('Erro ao carregar relatórios'); } finally { setLoadingData(false); }
  };

  if (loading || !profile) return null;

  return (
    <div className="bg-background min-h-screen">
      <PageHeader
        icon={FileBarChart}
        title="Relatórios de Empresas"
        subtitle="Visão completa de empresas, ativos e ordens de serviço"
        metrics={[
          { icon: Building2, label: "Empresas", value: stats.companies, color: "bg-blue-600/90" },
          { icon: Package, label: "Ativos", value: stats.assets, color: "bg-emerald-600/90" },
          { icon: Ticket, label: "Chamados", value: stats.tickets, color: "bg-amber-600/90" },
        ]}
        actions={
          <Button onClick={() => setIsPrintDialogOpen(true)} size="sm"
            className="h-8 text-xs gap-1 bg-white/10 hover:bg-white/20 text-white border-0">
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </Button>
        }
      />

      <main className="container mx-auto px-4 py-4">
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="inventory">Inventário</TabsTrigger>
            <TabsTrigger value="service-orders"><FileText className="h-4 w-4 mr-2" />OSs</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarIcon className="h-4 w-4 mr-2" />Calendário</TabsTrigger>
            <TabsTrigger value="daily-services"><ClipboardList className="h-4 w-4 mr-2" />Atendimentos</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><CompanyReportList reports={reports} loading={loadingData} /></TabsContent>
          <TabsContent value="inventory" className="space-y-4">{reports.map((r) => <InventoryReport key={r.company_id} companyId={r.company_id} />)}</TabsContent>
          <TabsContent value="service-orders"><ServiceOrderList statusFilter={statusFilter} /></TabsContent>
          <TabsContent value="calendar"><ServiceOrderCalendar /></TabsContent>
          <TabsContent value="daily-services"><DailyServicesReport /></TabsContent>
        </Tabs>
      </main>

      <ReportPrintDialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen} />
    </div>
  );
}
