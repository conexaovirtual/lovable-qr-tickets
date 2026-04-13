import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
  MessageSquare,
  TrendingUp,
  Ticket,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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
    atendimentos_remotos_hoje: 0,
    tickets_novo: 0,
    tickets_em_atendimento: 0,
    tickets_resolvido: 0,
    tickets_fechado: 0,
  });
  const [loading, setLoading] = useState(true);
  const [upcomingServiceOrders, setUpcomingServiceOrders] = useState<any[]>([]);
  const [recentServices, setRecentServices] = useState<any[]>([]);
  const [isCreateOSDialogOpen, setIsCreateOSDialogOpen] = useState(false);
  const [selectedServiceOrder, setSelectedServiceOrder] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isRemoteServiceDialogOpen, setIsRemoteServiceDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/auth');
    } else if (profile) {
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
      remotosHojeResult,
      ticketsNovoResult,
      ticketsEmAtendimentoResult,
      ticketsResolvidoResult,
      ticketsFechadoResult,
    ] = await Promise.all([
      supabase.from('assets').select('id', { count: 'exact', head: true }),
      profile?.roles?.includes('admin_provedor')
        ? supabase.from('companies').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: 0 }),
      supabase.from('service_orders').select('id', { count: 'exact', head: true }).gte('data_agendada', today.toISOString()).lt('data_agendada', tomorrow.toISOString()).in('status', ['agendada', 'confirmada', 'em_execucao']),
      supabase.from('service_orders').select('id', { count: 'exact', head: true }).in('status', ['agendada', 'confirmada']),
      supabase.from('service_orders').select('id', { count: 'exact', head: true }).eq('status', 'finalizada'),
      supabase.from('service_orders').select('id, numero_os, data_agendada, hora_agendada, status, companies(nome_fantasia), profiles!service_orders_tecnico_id_fkey(nome)').gte('data_agendada', today.toISOString()).lte('data_agendada', nextWeek.toISOString()).in('status', ['agendada', 'confirmada']).order('data_agendada', { ascending: true }).limit(5),
      supabase.from('daily_service_records').select('id, titulo, data_atendimento, status, companies(nome_fantasia)').gte('data_atendimento', firstDayOfMonth.toISOString().split('T')[0]).order('data_atendimento', { ascending: false }).limit(5),
      (profile?.roles?.includes('admin_provedor') || profile?.roles?.includes('tecnico'))
        ? supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('public_request', true).eq('status', 'novo')
        : Promise.resolve({ count: 0 }),
      supabase.from('daily_service_records').select('id', { count: 'exact', head: true }).eq('data_atendimento', todayStr).eq('canal', 'acesso_remoto'),
      supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'novo'),
      supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'em_atendimento'),
      supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'resolvido'),
      supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'fechado'),
    ]);

    setStats({
      ativos: assetsResult.count || 0,
      empresas: companiesResult.count || 0,
      os_agendadas_hoje: osHojeResult.count || 0,
      os_pendentes: osPendentesResult.count || 0,
      os_finalizadas: osFinalizadasResult.count || 0,
      atendimentos_mes: atendimentosMesResult.data?.length || 0,
      chamados_qrcode: qrcodeTicketsResult.count || 0,
      atendimentos_remotos_hoje: remotosHojeResult.count || 0,
      tickets_novo: ticketsNovoResult.count || 0,
      tickets_em_atendimento: ticketsEmAtendimentoResult.count || 0,
      tickets_resolvido: ticketsResolvidoResult.count || 0,
      tickets_fechado: ticketsFechadoResult.count || 0,
    });

    if (upcomingResult.data) setUpcomingServiceOrders(upcomingResult.data);
    if (atendimentosMesResult.data) setRecentServices(atendimentosMesResult.data);

    setLoading(false);
  };

  const handleViewServiceOrder = async (osId: string) => {
    const { data, error } = await supabase
      .from("service_orders")
      .select(`
        *,
        tickets (numero, titulo),
        companies:company_id (nome_fantasia, cnpj, endereco),
        profiles:tecnico_id (nome)
      `)
      .eq("id", osId)
      .single();

    if (!error && data) {
      setSelectedServiceOrder(data);
      setIsDetailDialogOpen(true);
    }
  };

  if (authLoading || !profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Skeleton className="h-96 w-full max-w-md" />
      </div>
    );
  }

  const totalTickets = stats.tickets_novo + stats.tickets_em_atendimento + stats.tickets_resolvido + stats.tickets_fechado;
  const ticketChartData = [
    { name: 'Novos', value: stats.tickets_novo, color: 'hsl(217, 91%, 60%)' },
    { name: 'Em Atendimento', value: stats.tickets_em_atendimento, color: 'hsl(38, 92%, 50%)' },
    { name: 'Resolvidos', value: stats.tickets_resolvido, color: 'hsl(142, 76%, 36%)' },
    { name: 'Fechados', value: stats.tickets_fechado, color: 'hsl(220, 9%, 46%)' },
  ].filter(d => d.value > 0);

  const isAdminOrTech = profile?.roles?.includes('admin_provedor') || profile?.roles?.includes('tecnico');

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Welcome banner */}
        <div className="rounded-xl bg-gradient-to-r from-primary to-[hsl(199,89%,48%)] p-6 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Olá, {profile.nome}!</h1>
              <p className="text-primary-foreground/80 mt-1">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div className="hidden md:flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
                onClick={() => setIsCreateOSDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova OS
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
                onClick={() => navigate('/tickets')}
              >
                <Ticket className="h-4 w-4 mr-1" />
                Chamados
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
                onClick={() => navigate('/daily-services')}
              >
                <ClipboardList className="h-4 w-4 mr-1" />
                Atendimentos
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <>
            <NotificationPermissionPrompt />

            {/* Smart Alerts */}
            {profile?.roles?.includes('admin_provedor') && <SmartAlertsPanel />}
            {isAdminOrTech && <DattoMonitoringPanel />}

            {/* QR Code alert */}
            {isAdminOrTech && stats.chamados_qrcode > 0 && (
              <Card className="border-destructive bg-destructive/5">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Novos Chamados via QR Code</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-bold text-destructive">{stats.chamados_qrcode}</span> aguardando atendimento
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => navigate('/tickets?filter=qrcode')} size="sm" variant="destructive">
                    Ver Chamados
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Meus Chamados - status counters */}
            {isAdminOrTech && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-primary" />
                    Meus Chamados
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')}>
                    Ver todos <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card
                    className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-[hsl(var(--info))]"
                    onClick={() => navigate('/tickets')}
                  >
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-muted-foreground">Novos</p>
                      <p className="text-3xl font-bold text-[hsl(var(--info))]">{stats.tickets_novo}</p>
                    </CardContent>
                  </Card>
                  <Card
                    className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-[hsl(var(--warning))]"
                    onClick={() => navigate('/tickets')}
                  >
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-muted-foreground">Em Atendimento</p>
                      <p className="text-3xl font-bold text-[hsl(var(--warning))]">{stats.tickets_em_atendimento}</p>
                    </CardContent>
                  </Card>
                  <Card
                    className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-[hsl(var(--success))]"
                    onClick={() => navigate('/tickets')}
                  >
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-muted-foreground">Resolvidos</p>
                      <p className="text-3xl font-bold text-[hsl(var(--success))]">{stats.tickets_resolvido}</p>
                    </CardContent>
                  </Card>
                  <Card
                    className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-muted-foreground"
                    onClick={() => navigate('/tickets')}
                  >
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-muted-foreground">Fechados</p>
                      <p className="text-3xl font-bold">{stats.tickets_fechado}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Stats grid + Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Stats cards */}
              <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard
                  icon={CalendarIcon}
                  label="OS Hoje"
                  value={stats.os_agendadas_hoje}
                  sub="Agendadas para hoje"
                  onClick={() => navigate('/reports?tab=calendar')}
                  iconColor="text-primary"
                  iconBg="bg-primary/10"
                />
                <StatCard
                  icon={Clock}
                  label="OS Pendentes"
                  value={stats.os_pendentes}
                  sub="Aguardando"
                  onClick={() => navigate('/reports?tab=service-orders&status=agendada')}
                  iconColor="text-[hsl(var(--warning))]"
                  iconBg="bg-[hsl(var(--warning))]/10"
                />
                <StatCard
                  icon={CheckCircle2}
                  label="OS Finalizadas"
                  value={stats.os_finalizadas}
                  sub="Concluídas"
                  onClick={() => navigate('/reports?tab=service-orders&status=finalizada')}
                  iconColor="text-[hsl(var(--success))]"
                  iconBg="bg-[hsl(var(--success))]/10"
                />
                <StatCard
                  icon={ClipboardList}
                  label="Atendimentos"
                  value={stats.atendimentos_mes}
                  sub="No mês atual"
                  onClick={() => navigate('/daily-services')}
                  iconColor="text-[hsl(var(--info))]"
                  iconBg="bg-[hsl(var(--info))]/10"
                />
                <StatCard
                  icon={Package}
                  label="Ativos"
                  value={stats.ativos}
                  sub="Cadastrados"
                  onClick={() => navigate('/inventory')}
                  iconColor="text-purple-500"
                  iconBg="bg-purple-500/10"
                />
                {profile?.roles?.includes('admin_provedor') && (
                  <StatCard
                    icon={Building2}
                    label="Empresas"
                    value={stats.empresas}
                    sub="Clientes"
                    onClick={() => navigate('/companies')}
                    iconColor="text-emerald-600"
                    iconBg="bg-emerald-600/10"
                  />
                )}
              </div>

              {/* Donut chart */}
              {totalTickets > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Chamados por Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <div className="h-[160px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={ticketChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            dataKey="value"
                            strokeWidth={2}
                            stroke="hsl(var(--card))"
                          >
                            {ticketChartData.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string) => [`${value}`, name]}
                            contentStyle={{
                              background: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {ticketChartData.map((item) => (
                        <div key={item.name} className="flex items-center gap-1.5 text-xs">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                          <span className="font-semibold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Remote service quick card */}
            {isAdminOrTech && (
              <QuickRemoteServiceCard
                atendimentosHoje={stats.atendimentos_remotos_hoje}
                onOpenDialog={() => setIsRemoteServiceDialogOpen(true)}
              />
            )}

            {/* Upcoming + Recent */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                      Próximos Agendamentos
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/agenda')}>
                      Ver agenda <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {upcomingServiceOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Nenhuma OS agendada nos próximos dias
                      </p>
                    ) : (
                      upcomingServiceOrders.map((os) => (
                        <div
                          key={os.id}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => handleViewServiceOrder(os.id)}
                        >
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm">OS #{os.numero_os}</span>
                              <span className="text-xs text-muted-foreground">
                                {os.data_agendada && formatDateBR(os.data_agendada)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{os.companies?.nome_fantasia}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {os.hora_agendada?.slice(0, 5) || '—'}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      Atendimentos Recentes
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/daily-services')}>
                      Ver todos <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Nenhum atendimento recente
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => navigate('/daily-services')}
                        >
                          <div className="h-9 w-9 rounded-lg bg-[hsl(var(--info))]/10 flex items-center justify-center shrink-0">
                            <ClipboardList className="h-4 w-4 text-[hsl(var(--info))]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{service.titulo}</p>
                            <p className="text-xs text-muted-foreground">{service.companies?.nome_fantasia}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">
                              {service.data_atendimento && formatDateBR(service.data_atendimento)}
                            </p>
                            <Badge variant="secondary" className="text-[10px] mt-0.5">
                              {service.status?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                <QuickAction icon={FileText} label="Nova OS" onClick={() => setIsCreateOSDialogOpen(true)} />
                <QuickAction icon={Monitor} label="Remoto" onClick={() => setIsRemoteServiceDialogOpen(true)} variant="purple" />
                <QuickAction icon={ClipboardList} label="Atendimentos" onClick={() => navigate('/daily-services')} />
                <QuickAction icon={Package} label="Ativos" onClick={() => navigate('/assets')} />
                <QuickAction icon={Bot} label="IA Suporte" onClick={() => navigate('/ai-support')} />
                <QuickAction icon={MessageSquare} label="WhatsApp" onClick={() => navigate('/whatsapp-platform')} variant="primary" />
              </CardContent>
            </Card>
          </>
        )}
      </div>

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

/* Sub-components */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  onClick,
  iconColor,
  iconBg,
}: {
  icon: any;
  label: string;
  value: number;
  sub: string;
  onClick: () => void;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-all" onClick={onClick}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  variant,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'purple';
}) {
  const colorClasses = variant === 'purple'
    ? 'hover:bg-purple-50 dark:hover:bg-purple-950/20 text-purple-600 dark:text-purple-400'
    : variant === 'primary'
    ? 'hover:bg-primary/5 text-primary'
    : 'hover:bg-accent';

  return (
    <Button
      variant="outline"
      className={`h-auto flex-col gap-1.5 py-3 ${colorClasses}`}
      onClick={onClick}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs">{label}</span>
    </Button>
  );
}
