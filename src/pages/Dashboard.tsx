import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/layout/AppHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { ServiceOrderCreateDialog } from '@/components/service-orders/ServiceOrderCreateDialog';
import { ServiceOrderDetailDialog } from '@/components/service-orders/ServiceOrderDetailDialog';
import { NotificationPermissionPrompt } from '@/components/notifications/NotificationPermissionPrompt';
import { QuickRemoteServiceCard } from '@/components/dashboard/QuickRemoteServiceCard';
import { RemoteServiceQuickDialog } from '@/components/dashboard/RemoteServiceQuickDialog';
import { SmartAlertsPanel } from '@/components/ai/SmartAlertsPanel';
import { DattoMonitoringPanel } from '@/components/dashboard/DattoMonitoringPanel';
import { formatDateBR } from '@/lib/formatters';
import { 
  Clock, 
  CheckCircle2, 
  Package,
  Building2,
  FileText,
  Calendar as CalendarIcon,
  ClipboardList,
  Monitor,
  AlertCircle,
  Bot,
  MessageSquare
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    ativos: 0,
    empresas: 0,
    os_agendadas_hoje: 0,
    os_pendentes: 0,
    os_finalizadas: 0,
    atendimentos_mes: 0,
    chamados_qrcode: 0,
    atendimentos_remotos_hoje: 0
  });
  const [loading, setLoading] = useState(true);
  const [upcomingServiceOrders, setUpcomingServiceOrders] = useState<any[]>([]);
  const [recentServices, setRecentServices] = useState<any[]>([]);
  const [isCreateOSDialogOpen, setIsCreateOSDialogOpen] = useState(false);
  const [selectedServiceOrder, setSelectedServiceOrder] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isRemoteServiceDialogOpen, setIsRemoteServiceDialogOpen] = useState(false);

  useEffect(() => {
    // DEBUG: Log detalhado das roles para diagnóstico
    console.log('[Dashboard] ===== DEBUG ROLES =====');
    console.log('[Dashboard] Auth loading:', authLoading);
    console.log('[Dashboard] Profile:', profile);
    console.log('[Dashboard] Profile roles:', profile?.roles);
    console.log('[Dashboard] Is admin_provedor?:', profile?.roles?.includes('admin_provedor'));
    console.log('[Dashboard] Is tecnico?:', profile?.roles?.includes('tecnico'));
    console.log('[Dashboard] Should show DATTO card?:', 
      profile?.roles?.includes('admin_provedor') || profile?.roles?.includes('tecnico'));
    console.log('[Dashboard] ===== END DEBUG =====');
    
    if (!authLoading && !profile) {
      console.log('[Dashboard] No profile found, redirecting to /auth');
      navigate('/auth');
    } else if (profile) {
      console.log('[Dashboard] Profile loaded, loading dashboard data');
      loadDashboardData();
    }
  }, [profile, authLoading, navigate]);

  const loadDashboardData = async () => {
    setLoading(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Executar queries em paralelo
    const todayStr = today.toISOString().split('T')[0];
    const [
      assetsResult,
      companiesResult,
      osHojeResult,
      osPendentesResult,
      osFinalizadasResult,
      upcomingResult,
      atendimentosMesResult,
      qrcodeTicketsResult,
      remotosHojeResult
    ] = await Promise.all([
      supabase.from('assets').select('id', { count: 'exact', head: true }),
      profile?.roles?.includes('admin_provedor') 
        ? supabase.from('companies').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: 0 }),
      supabase.from('service_orders').select('id').gte('data_agendada', today.toISOString()).lt('data_agendada', tomorrow.toISOString()).in('status', ['agendada', 'confirmada', 'em_execucao']),
      supabase.from('service_orders').select('id').in('status', ['agendada', 'confirmada']),
      supabase.from('service_orders').select('id').eq('status', 'finalizada'),
      supabase.from('service_orders').select('*, companies(nome_fantasia), profiles!service_orders_tecnico_id_fkey(nome)').gte('data_agendada', today.toISOString()).lte('data_agendada', nextWeek.toISOString()).in('status', ['agendada', 'confirmada']).order('data_agendada', { ascending: true }).limit(5),
      supabase.from('daily_service_records').select('id, titulo, data_atendimento, status, companies(nome_fantasia)').gte('data_atendimento', firstDayOfMonth.toISOString().split('T')[0]).order('data_atendimento', { ascending: false }).limit(5),
      (profile?.roles?.includes('admin_provedor') || profile?.roles?.includes('tecnico'))
        ? supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('public_request', true).eq('status', 'novo')
        : Promise.resolve({ count: 0 }),
      supabase.from('daily_service_records').select('id', { count: 'exact', head: true }).eq('data_atendimento', todayStr).eq('canal', 'acesso_remoto')
    ]);

    setStats({
      ativos: assetsResult.count || 0,
      empresas: companiesResult.count || 0,
      os_agendadas_hoje: osHojeResult.data?.length || 0,
      os_pendentes: osPendentesResult.data?.length || 0,
      os_finalizadas: osFinalizadasResult.data?.length || 0,
      atendimentos_mes: atendimentosMesResult.data?.length || 0,
      chamados_qrcode: qrcodeTicketsResult.count || 0,
      atendimentos_remotos_hoje: remotosHojeResult.count || 0
    });

    if (upcomingResult.data) setUpcomingServiceOrders(upcomingResult.data);
    if (atendimentosMesResult.data) setRecentServices(atendimentosMesResult.data);

    setLoading(false);
  };

  const handleViewServiceOrder = async (osId: string) => {
    console.log('[Dashboard] Opening service order:', osId);
    const { data, error } = await supabase
      .from("service_orders")
      .select(`
        *,
        tickets (numero, titulo),
        companies:companies_safe (nome_fantasia, cnpj, endereco),
        profiles:tecnico_id (nome)
      `)
      .eq("id", osId)
      .single();

    console.log('[Dashboard] Service order data:', data, 'error:', error);
    
    if (!error && data) {
      setSelectedServiceOrder(data);
      setIsDetailDialogOpen(true);
    }
  };

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-96 w-full max-w-md" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Bem-vindo, {profile.nome}</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <>
            <NotificationPermissionPrompt />

            {/* Smart Alerts Panel for admins */}
            {profile?.roles?.includes('admin_provedor') && (
              <SmartAlertsPanel />
            )}

            {/* Datto RMM Monitoring Panel */}
            {(profile?.roles?.includes('admin_provedor') || profile?.roles?.includes('tecnico')) && (
              <DattoMonitoringPanel />
            )}

            {(profile?.roles?.includes('admin_provedor') || profile?.roles?.includes('tecnico')) && (
              <QuickRemoteServiceCard
                atendimentosHoje={stats.atendimentos_remotos_hoje}
                onOpenDialog={() => setIsRemoteServiceDialogOpen(true)}
              />
            )}
            
            {(profile?.roles?.includes('admin_provedor') || profile?.roles?.includes('tecnico')) && stats.chamados_qrcode > 0 && (
              <Card className="mb-6 border-destructive bg-destructive/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <CardTitle className="text-base">Novos Chamados via QR Code</CardTitle>
                    </div>
                    <Button onClick={() => navigate('/tickets?filter=qrcode')} size="sm">
                      Ver Chamados
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-bold text-destructive text-lg">{stats.chamados_qrcode}</span> {stats.chamados_qrcode === 1 ? 'chamado novo' : 'chamados novos'} aguardando atendimento
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate('/inventory')}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Ativos</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.ativos}</div>
                  <p className="text-xs text-muted-foreground">Equipamentos cadastrados</p>
                </CardContent>
              </Card>

              {profile?.roles?.includes('admin_provedor') && (
                <Card 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate('/companies')}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Empresas</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.empresas}</div>
                    <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
                  </CardContent>
                </Card>
              )}

              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate('/daily-services')}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Atendimentos no Mês</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.atendimentos_mes}</div>
                  <p className="text-xs text-muted-foreground">Registros do mês atual</p>
                </CardContent>
              </Card>

              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate('/reports?tab=calendar')}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">OS Agendadas Hoje</CardTitle>
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.os_agendadas_hoje}</div>
                  <p className="text-xs text-muted-foreground">Atendimentos do dia</p>
                </CardContent>
              </Card>

              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate('/reports?tab=service-orders&status=agendada')}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">OS Pendentes</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.os_pendentes}</div>
                  <p className="text-xs text-muted-foreground">Aguardando atendimento</p>
                </CardContent>
              </Card>

              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate('/reports?tab=service-orders&status=finalizada')}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">OS Finalizadas</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.os_finalizadas}</div>
                  <p className="text-xs text-muted-foreground">Total concluídas</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Próximos Agendamentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {upcomingServiceOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma OS agendada nos próximos dias
                      </p>
                    ) : (
                      upcomingServiceOrders.map((os) => (
                        <div 
                          key={os.id} 
                          className="flex flex-col gap-1 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => handleViewServiceOrder(os.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm">OS #{os.numero_os}</span>
                            <span className="text-xs text-muted-foreground">
                              {os.data_agendada && formatDateBR(os.data_agendada)}
                            </span>
                          </div>
                          <div className="text-sm">{os.companies?.nome_fantasia}</div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{os.profiles?.nome || "Não atribuído"}</span>
                            <span>{os.hora_agendada?.slice(0, 5)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Atendimentos Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum atendimento recente
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {recentServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => navigate('/daily-services')}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-muted-foreground">
                                {service.data_atendimento && formatDateBR(service.data_atendimento)}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary capitalize">
                                {service.status.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-sm font-medium truncate">{service.titulo}</p>
                            <p className="text-xs text-muted-foreground">{service.companies?.nome_fantasia}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Button onClick={() => setIsCreateOSDialogOpen(true)} className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Nova Ordem de Serviço
                </Button>
                <Button 
                  onClick={() => setIsRemoteServiceDialogOpen(true)} 
                  variant="outline" 
                  className="w-full justify-start border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/30"
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Novo Atendimento Remoto
                </Button>
                <Button onClick={() => navigate('/daily-services')} variant="outline" className="w-full justify-start">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Ver Atendimentos
                </Button>
                <Button onClick={() => navigate('/assets')} variant="outline" className="w-full justify-start">
                  <Package className="h-4 w-4 mr-2" />
                  Gerenciar Ativos
                </Button>
                <Button onClick={() => navigate('/ai-support')} variant="outline" className="w-full justify-start">
                  <Bot className="h-4 w-4 mr-2" />
                  Assistente IA de Suporte
                </Button>
                <Button onClick={() => navigate('/whatsapp-platform')} variant="outline" className="w-full justify-start border-primary/30 text-primary hover:bg-primary/5">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Plataforma WhatsApp
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <ServiceOrderCreateDialog
        open={isCreateOSDialogOpen}
        onOpenChange={setIsCreateOSDialogOpen}
        onSuccess={loadDashboardData}
      />

      <ServiceOrderDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        serviceOrder={selectedServiceOrder}
        onUpdate={loadDashboardData}
      />

      <RemoteServiceQuickDialog
        open={isRemoteServiceDialogOpen}
        onOpenChange={setIsRemoteServiceDialogOpen}
        onSuccess={loadDashboardData}
      />
    </div>
  );
}