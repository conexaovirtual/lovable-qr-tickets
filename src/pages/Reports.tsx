import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { CompanyReportList } from '@/components/reports/CompanyReportList';
import { ReportPrintDialog } from '@/components/reports/ReportPrintDialog';
import { InventoryReport } from '@/components/reports/InventoryReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileBarChart, Building2, Package, Ticket, Printer, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ServiceOrderList } from '@/components/service-orders/ServiceOrderList';
import { ServiceOrderCalendar } from '@/components/service-orders/ServiceOrderCalendar';

export default function Reports() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState<any[]>([]);
  const [stats, setStats] = useState({ companies: 0, assets: 0, tickets: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  
  // Get tab and status from URL params
  const defaultTab = searchParams.get('tab') || 'overview';
  const statusFilter = searchParams.get('status');

  useEffect(() => {
    if (!loading && !profile) {
      navigate('/auth');
      return;
    }

    if (profile && !profile.roles?.includes('admin_provedor') && !profile.roles?.includes('gestor_cliente')) {
      navigate('/dashboard');
      toast.error('Acesso negado');
      return;
    }

    if (profile) {
      loadReports();
    }
  }, [profile, loading, navigate]);

  const loadReports = async () => {
    try {
      setLoadingData(true);
      
      const { data, error } = await supabase
        .from('company_statistics')
        .select('*')
        .order('nome_fantasia');

      if (error) throw error;

      setReports(data || []);
      
      // Calculate totals
      const totals = (data || []).reduce(
        (acc, curr) => ({
          companies: acc.companies + 1,
          assets: acc.assets + (curr.total_ativos || 0),
          tickets: acc.tickets + (curr.total_tickets || 0),
        }),
        { companies: 0, assets: 0, tickets: 0 }
      );
      
      setStats(totals);
    } catch (error: any) {
      console.error('Error loading reports:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileBarChart className="h-8 w-8 text-primary" />
              Relatórios de Empresas
            </h1>
            <p className="text-muted-foreground mt-1">
              Visão completa de empresas, ativos e ordens de serviço
            </p>
          </div>
          
          <Button onClick={() => setIsPrintDialogOpen(true)} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir Relatório
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empresas Ativas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.companies}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Ativos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.assets}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Chamados</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tickets}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="inventory">Inventário</TabsTrigger>
            <TabsTrigger value="service-orders">
              <FileText className="h-4 w-4 mr-2" />
              Lista de OSs
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Calendário
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CompanyReportList reports={reports} loading={loadingData} />
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            {reports.map((report) => (
              <InventoryReport key={report.company_id} companyId={report.company_id} />
            ))}
          </TabsContent>

          <TabsContent value="service-orders">
            <ServiceOrderList statusFilter={statusFilter} />
          </TabsContent>

          <TabsContent value="calendar">
            <ServiceOrderCalendar />
          </TabsContent>
        </Tabs>
      </main>

      <ReportPrintDialog
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
      />
    </div>
  );
}
