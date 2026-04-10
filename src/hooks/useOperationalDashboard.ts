import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format, startOfWeek, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type PeriodFilter = '7d' | '14d' | '30d';

function getDaysBack(period: PeriodFilter): number {
  return period === '7d' ? 7 : period === '14d' ? 14 : 30;
}

export function useOperationalDashboard(period: PeriodFilter = '14d') {
  const daysBack = getDaysBack(period);
  const startDate = format(subDays(new Date(), daysBack), 'yyyy-MM-dd');

  const { data: dailyRecords = [], isLoading: loadingRecords } = useQuery({
    queryKey: ['op-dashboard-records', startDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_service_records')
        .select('id, titulo, descricao, canal, status, data_atendimento, company_id, ticket_id, companies:company_id(nome_fantasia)')
        .gte('data_atendimento', startDate)
        .order('data_atendimento', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['op-dashboard-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, titulo, status, category_id, created_at, categories:category_id(nome)')
        .in('status', ['novo', 'em_atendimento', 'aguardando_usuario', 'aguardando_peca', 'resolvido', 'fechado', 'triagem', 'validando_cliente']);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ['op-dashboard-assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('id, nome, datto_status, company_id, companies:company_id(nome_fantasia)')
        .not('datto_device_uid', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  // KPIs
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { locale: ptBR }), 'yyyy-MM-dd');

  const attendancesToday = dailyRecords.filter(r => r.data_atendimento === today).length;
  const attendancesWeek = dailyRecords.filter(r => r.data_atendimento >= weekStart).length;

  const onlineDevices = assets.filter(a => a.datto_status === 'online').length;
  const offlineDevices = assets.filter(a => a.datto_status === 'offline').length;
  const alertDevices = assets.filter(a => a.datto_status === 'alert' || (a.datto_status && !['online', 'offline'].includes(a.datto_status))).length;

  const openTickets = tickets.filter(t => ['novo', 'em_atendimento', 'aguardando_usuario', 'aguardando_peca', 'triagem', 'validando_cliente'].includes(t.status || '')).length;
  const resolvedTickets = tickets.filter(t => ['resolvido', 'fechado'].includes(t.status || '')).length;
  const resolutionRate = tickets.length > 0 ? Math.round((resolvedTickets / tickets.length) * 100) : 0;

  // Chart: Atendimentos por dia
  const attendanceByDay = (() => {
    const map: Record<string, number> = {};
    for (let i = daysBack - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      map[d] = 0;
    }
    dailyRecords.forEach(r => {
      if (map[r.data_atendimento] !== undefined) map[r.data_atendimento]++;
    });
    return Object.entries(map).map(([date, count]) => ({
      date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
      atendimentos: count,
    }));
  })();

  // Chart: Top 5 problemas recorrentes (by ticket category or service title keywords)
  const topProblems = (() => {
    const catMap: Record<string, number> = {};
    tickets.forEach(t => {
      const catName = (t.categories as any)?.nome || 'Sem categoria';
      catMap[catName] = (catMap[catName] || 0) + 1;
    });
    return Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  })();

  // Chart: Distribuição por canal
  const channelDistribution = (() => {
    const channelLabels: Record<string, string> = {
      whatsapp: 'WhatsApp',
      ligacao: 'Ligação',
      acesso_remoto: 'Acesso Remoto',
      presencial: 'Presencial',
      email: 'E-mail',
      web: 'Web',
    };
    const map: Record<string, number> = {};
    dailyRecords.forEach(r => {
      const label = channelLabels[r.canal] || r.canal;
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  })();

  // Chart: Top 10 empresas
  const topCompanies = (() => {
    const map: Record<string, number> = {};
    dailyRecords.forEach(r => {
      const name = (r.companies as any)?.nome_fantasia || 'N/A';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  })();

  // Chart: Tendência semanal (últimas 8 semanas)
  const weeklyTrend = (() => {
    const weeks: Record<string, number> = {};
    for (let i = 7; i >= 0; i--) {
      const ws = startOfWeek(subDays(new Date(), i * 7), { locale: ptBR });
      const key = format(ws, 'dd/MM', { locale: ptBR });
      weeks[key] = 0;
    }
    dailyRecords.forEach(r => {
      const ws = startOfWeek(parseISO(r.data_atendimento), { locale: ptBR });
      const key = format(ws, 'dd/MM', { locale: ptBR });
      if (weeks[key] !== undefined) weeks[key]++;
    });
    return Object.entries(weeks).map(([semana, atendimentos]) => ({ semana, atendimentos }));
  })();

  // Chart: Dispositivos por empresa
  const devicesByCompany = (() => {
    const map: Record<string, { online: number; offline: number; alert: number }> = {};
    assets.forEach(a => {
      const name = (a.companies as any)?.nome_fantasia || 'N/A';
      if (!map[name]) map[name] = { online: 0, offline: 0, alert: 0 };
      if (a.datto_status === 'online') map[name].online++;
      else if (a.datto_status === 'offline') map[name].offline++;
      else map[name].alert++;
    });
    return Object.entries(map)
      .sort((a, b) => (b[1].online + b[1].offline + b[1].alert) - (a[1].online + a[1].offline + a[1].alert))
      .slice(0, 10)
      .map(([name, counts]) => ({ name, ...counts }));
  })();

  return {
    isLoading: loadingRecords || loadingTickets || loadingAssets,
    kpis: {
      attendancesToday,
      attendancesWeek,
      onlineDevices,
      offlineDevices,
      alertDevices,
      openTickets,
      resolutionRate,
    },
    charts: {
      attendanceByDay,
      topProblems,
      channelDistribution,
      topCompanies,
      weeklyTrend,
      devicesByCompany,
    },
  };
}
