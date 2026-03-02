import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/layout/AppHeader';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, isSameDay, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Ticket, ClipboardList, MapPin, Plus, FileText, Filter } from 'lucide-react';

type AgendaItem = {
  id: string;
  type: 'os' | 'ticket' | 'atendimento' | 'visita';
  title: string;
  company: string;
  time?: string;
  status: string;
  priority?: string;
  details?: string;
  link?: string;
};

const typeConfig = {
  os: { label: 'Ordem de Serviço', color: 'bg-blue-500', badge: 'default' as const, icon: FileText },
  ticket: { label: 'Chamado', color: 'bg-orange-500', badge: 'secondary' as const, icon: Ticket },
  atendimento: { label: 'Atendimento', color: 'bg-green-500', badge: 'outline' as const, icon: ClipboardList },
  visita: { label: 'Visita', color: 'bg-purple-500', badge: 'destructive' as const, icon: MapPin },
};

export default function Agenda() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  // Fetch service orders for the month
  const { data: serviceOrders = [] } = useQuery({
    queryKey: ['agenda-os', monthStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('service_orders')
        .select('id, numero_os, descricao_servicos, status, prioridade, data_agendada, hora_agendada, modalidade, tipo_servico, companies:company_id(nome_fantasia)')
        .gte('data_agendada', monthStart.toISOString())
        .lte('data_agendada', monthEnd.toISOString())
        .order('data_agendada');
      return data || [];
    },
    enabled: !!profile,
  });

  // Fetch open tickets
  const { data: tickets = [] } = useQuery({
    queryKey: ['agenda-tickets', monthStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('tickets')
        .select('id, numero, titulo, status, prioridade, urgencia, created_at, companies:company_id(nome_fantasia)')
        .in('status', ['novo', 'em_atendimento'])
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!profile,
  });

  // Fetch daily service records for the month
  const { data: dailyRecords = [] } = useQuery({
    queryKey: ['agenda-daily', monthStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_service_records')
        .select('id, titulo, descricao, status, data_atendimento, hora_inicio, hora_fim, canal, companies:company_id(nome_fantasia)')
        .gte('data_atendimento', format(monthStart, 'yyyy-MM-dd'))
        .lte('data_atendimento', format(monthEnd, 'yyyy-MM-dd'))
        .order('data_atendimento');
      return data || [];
    },
    enabled: !!profile,
  });

  // Fetch visit schedules for the month
  const { data: visitSchedules = [] } = useQuery({
    queryKey: ['agenda-visits', monthStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('visit_schedules')
        .select('id, proxima_visita, motivo, status, prioridade, observacoes, companies:company_id(nome_fantasia)')
        .gte('proxima_visita', format(monthStart, 'yyyy-MM-dd'))
        .lte('proxima_visita', format(monthEnd, 'yyyy-MM-dd'))
        .order('proxima_visita');
      return data || [];
    },
    enabled: !!profile,
  });

  // Build unified agenda items
  const allItems = useMemo(() => {
    const items: AgendaItem[] = [];

    serviceOrders.forEach((os: any) => {
      items.push({
        id: `os-${os.id}`,
        type: 'os',
        title: `OS #${os.numero_os} - ${os.descricao_servicos?.substring(0, 60)}`,
        company: os.companies?.nome_fantasia || 'N/A',
        time: os.hora_agendada?.substring(0, 5) || undefined,
        status: os.status,
        priority: os.prioridade,
        details: `${os.tipo_servico || 'corretivo'} / ${os.modalidade || 'presencial'}`,
        link: `/reports?tab=service-orders`,
      });
    });

    tickets.forEach((t: any) => {
      items.push({
        id: `ticket-${t.id}`,
        type: 'ticket',
        title: `#${t.numero} - ${t.titulo}`,
        company: t.companies?.nome_fantasia || 'N/A',
        status: t.status,
        priority: t.prioridade,
        details: `Urgência: ${t.urgencia}`,
        link: `/tickets/${t.id}`,
      });
    });

    dailyRecords.forEach((r: any) => {
      items.push({
        id: `daily-${r.id}`,
        type: 'atendimento',
        title: r.titulo,
        company: r.companies?.nome_fantasia || 'N/A',
        time: r.hora_inicio?.substring(0, 5) || undefined,
        status: r.status,
        details: `Canal: ${r.canal}`,
        link: '/daily-services',
      });
    });

    visitSchedules.forEach((v: any) => {
      items.push({
        id: `visit-${v.id}`,
        type: 'visita',
        title: `Visita - ${v.motivo}`,
        company: v.companies?.nome_fantasia || 'N/A',
        status: v.status,
        priority: v.prioridade,
        details: v.observacoes?.substring(0, 60) || undefined,
      });
    });

    return items;
  }, [serviceOrders, tickets, dailyRecords, visitSchedules]);

  // Get dates that have items for calendar dots
  const datesWithItems = useMemo(() => {
    const dateMap = new Map<string, Set<string>>();

    serviceOrders.forEach((os: any) => {
      if (os.data_agendada) {
        const d = format(parseISO(os.data_agendada), 'yyyy-MM-dd');
        if (!dateMap.has(d)) dateMap.set(d, new Set());
        dateMap.get(d)!.add('os');
      }
    });

    dailyRecords.forEach((r: any) => {
      const d = r.data_atendimento;
      if (!dateMap.has(d)) dateMap.set(d, new Set());
      dateMap.get(d)!.add('atendimento');
    });

    visitSchedules.forEach((v: any) => {
      const d = v.proxima_visita;
      if (!dateMap.has(d)) dateMap.set(d, new Set());
      dateMap.get(d)!.add('visita');
    });

    return dateMap;
  }, [serviceOrders, dailyRecords, visitSchedules]);

  // Filter items for selected date
  const selectedDateItems = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    return allItems.filter((item) => {
      // Type filter
      if (activeFilter !== 'all' && item.type !== activeFilter) return false;

      // Date filter
      if (item.type === 'os') {
        const os = serviceOrders.find((o: any) => `os-${o.id}` === item.id);
        return os?.data_agendada && format(parseISO(os.data_agendada), 'yyyy-MM-dd') === dateStr;
      }
      if (item.type === 'atendimento') {
        const r = dailyRecords.find((d: any) => `daily-${d.id}` === item.id);
        return r?.data_atendimento === dateStr;
      }
      if (item.type === 'visita') {
        const v = visitSchedules.find((vs: any) => `visit-${vs.id}` === item.id);
        return v?.proxima_visita === dateStr;
      }
      // Tickets show on their creation date
      if (item.type === 'ticket') {
        const t = tickets.find((tk: any) => `ticket-${tk.id}` === item.id);
        return t?.created_at && format(parseISO(t.created_at), 'yyyy-MM-dd') === dateStr;
      }
      return false;
    }).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  }, [allItems, selectedDate, activeFilter, serviceOrders, dailyRecords, visitSchedules, tickets]);

  if (loading) return null;
  if (!profile) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" />
              Agenda Unificada
            </h1>
            <p className="text-muted-foreground text-sm">
              Todas as atividades consolidadas em uma visão
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigate('/service-orders/new')}>
              <Plus className="h-4 w-4 mr-1" />
              Nova OS
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/daily-services')}>
              <ClipboardList className="h-4 w-4 mr-1" />
              Atendimento
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-1">
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                locale={ptBR}
                className="w-full"
                modifiers={{
                  hasOs: (date) => datesWithItems.has(format(date, 'yyyy-MM-dd')) && (datesWithItems.get(format(date, 'yyyy-MM-dd'))?.has('os') || false),
                  hasAtendimento: (date) => datesWithItems.has(format(date, 'yyyy-MM-dd')) && (datesWithItems.get(format(date, 'yyyy-MM-dd'))?.has('atendimento') || false),
                  hasVisita: (date) => datesWithItems.has(format(date, 'yyyy-MM-dd')) && (datesWithItems.get(format(date, 'yyyy-MM-dd'))?.has('visita') || false),
                }}
                modifiersStyles={{
                  hasOs: { borderBottom: '3px solid hsl(217, 91%, 60%)' },
                  hasAtendimento: { borderBottom: '3px solid hsl(142, 71%, 45%)' },
                  hasVisita: { borderBottom: '3px solid hsl(271, 91%, 65%)' },
                }}
              />

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded-full ${cfg.color}`} />
                    <span>{cfg.label}</span>
                  </div>
                ))}
              </div>

              {/* Summary counts */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="bg-blue-500/10 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-600">{serviceOrders.length}</div>
                  <div className="text-xs text-muted-foreground">OS no mês</div>
                </div>
                <div className="bg-orange-500/10 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-orange-600">{tickets.length}</div>
                  <div className="text-xs text-muted-foreground">Chamados abertos</div>
                </div>
                <div className="bg-green-500/10 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-600">{dailyRecords.length}</div>
                  <div className="text-xs text-muted-foreground">Atendimentos</div>
                </div>
                <div className="bg-purple-500/10 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-purple-600">{visitSchedules.length}</div>
                  <div className="text-xs text-muted-foreground">Visitas</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Day detail */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  📅 {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={activeFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setActiveFilter('all')}
                    className="text-xs h-7"
                  >
                    Todos
                  </Button>
                  {Object.entries(typeConfig).map(([key, cfg]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={activeFilter === key ? 'default' : 'outline'}
                      onClick={() => setActiveFilter(key)}
                      className="text-xs h-7"
                    >
                      {cfg.label.split(' ')[0]}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedDateItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma atividade para este dia</p>
                  <p className="text-xs mt-1">Selecione outro dia ou crie uma nova atividade</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateItems.map((item) => {
                    const cfg = typeConfig[item.type];
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => item.link && navigate(item.link)}
                      >
                        <div className={`p-2 rounded-lg ${cfg.color} text-white shrink-0`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {item.time && (
                              <span className="text-sm font-mono font-semibold text-primary">
                                {item.time}
                              </span>
                            )}
                            <Badge variant={cfg.badge} className="text-xs">
                              {cfg.label}
                            </Badge>
                            {item.priority && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  item.priority === 'alta' || item.priority === 'critica'
                                    ? 'border-red-500 text-red-600'
                                    : item.priority === 'media'
                                    ? 'border-yellow-500 text-yellow-600'
                                    : 'border-green-500 text-green-600'
                                }`}
                              >
                                {item.priority}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>🏢 {item.company}</span>
                            {item.details && <span>• {item.details}</span>}
                            <Badge variant="outline" className="text-xs">
                              {item.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
