import { useEffect, useState, useCallback } from 'react';
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
  Clock, CheckCircle2, Package, Building2, FileText,
  Calendar as CalendarIcon, ClipboardList, Monitor, AlertCircle, Bot,
  MessageSquare, TrendingUp, Ticket, ArrowRight, Plus, RefreshCw,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const CHART_COLORS = {
  novo: '#3b82f6',
  em_atendimento: '#f59e0b',
  resolvido: '#16a34a',
  fechado: '#6b7280',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    ativos: 0, empresas: 0, os_agendadas_hoje: 0, os_pendentes: 0,
    os_finalizadas: 0, atendimentos_mes: 0, chamados_qrcode: 0,
    atendimentos_remotos_hoje: 0, tickets_novo: 0, tickets_em_atendimento: 0,
    tickets_resolvido: 0, tickets_fechado: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [upcomingServiceOrders, setUpcomingServiceOrders] = useState<any[]>([]);
  const [recentServices, setRecentServices] = useState<any[]>([]);
  const [isCreateOSDialogOpen, setIsCreateOSDialogOpen] = useState(false);
  const [selectedServiceOrder, setSelectedServiceOrder] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isRemoteServiceDialogOpen, setIsRemoteServiceDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !profile) navigate('/auth');
    else if (profile) loadDashboardData();
  }, [profile?.id, authLoading]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const todayStr = today.toISOString().split('T')[0];

      const results = await Promise.allSettled([
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

      const getValue = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' ? (r.value?.count ?? r.value?.data?.length ?? 0) : 0;

      const [
        assetsR, companiesR, osHojeR, osPendentesR, osFinalizadasR,
        upcomingR, atendimentosR, qrcodeR, remotosR,
        tNovo, tAtend, tResolvido, tFechado,
      ] = results;

      setStats({
        ativos: getValue(assetsR),
        empresas: getValue(companiesR),
        os_agendadas_hoje: getValue(osHojeR),
        os_pendentes: getValue(osPendentesR),
        os_finalizadas: getValue(osFinalizadasR),
        atendimentos_mes: atendimentosR.status === 'fulfilled' ? atendimentosR.value?.data?.length ?? 0 : 0,
        chamados_qrcode: getValue(qrcodeR),
        atendimentos_remotos_hoje: getValue(remotosR),
        tickets_novo: getValue(tNovo),
        tickets_em_atendimento: getValue(tAtend),
        tickets_resolvido: getValue(tResolvido),
        tickets_fechado: getValue(tFechado),
      });

      if (upcomingR.status === 'fulfilled') setUpcomingServiceOrders(upcomingR.value?.data || []);
      if (atendimentosR.status === 'fulfilled') setRecentServices(atendimentosR.value?.data || []);
    } catch (err) {
      console.error('[Dashboard] Erro:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const handleViewServiceOrder = async (osId: string) => {
    const { data, error } = await supabase
      .from('service_orders')
      .select(`*, tickets(numero, titulo), companies:company_id(nome_fantasia, cnpj, endereco), profiles:tecnico_id(nome)`)
      .eq('id', osId).single();
    if (!error && data) { setSelectedServiceOrder(data); setIsDetailDialogOpen(true); }
  };

  if (authLoading || !profile) {
    return <div className="flex items-center justify-center py-20"><Skeleton className="h-96 w-full max-w-md" /></div>;
  }

  const totalTickets = stats.tickets_novo + stats.tickets_em_atendimento + stats.tickets_resolvido + stats.tickets_fechado;
  const ticketChartData = [
    { name: 'Novos', value: stats.tickets_novo, color: CHART_COLORS.novo },
    { name: 'Em Atendimento', value: stats.tickets_em_atendimento, color: CHART_COLORS.em_atendimento },
    { name: 'Resolvidos', value: stats.tickets_resolvido, color: CHART_COLORS.resolvido },
    { name: 'Fechados', value: stats.tickets_fechado, color: CHART_COLORS.fechado },
  ].filter(d => d.value > 0);

  const isAdminOrTech = profile?.roles?.includes('admin_provedor') || profile?.roles?.includes('tecnico');

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">

        {/* Banner de boas-vindas */}
        <div className="rounded-xl bg-gradient-to-r from-primary to-[hsl(199,89%,48%)] p-6 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Olá, {profile.nome}!</h1>
              <p className="text-primary-foreground/80 mt-1">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div className="hidden md:flex gap-2">
              <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-primary-foreground border-0" onClick={() => setIsCreateOSDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Nova OS
              </Button>
              <Button variant="secondary" size="sm" classNam