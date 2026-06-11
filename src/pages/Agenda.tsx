import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  format, startOfMonth, endOfMonth, parseISO,
  startOfWeek, endOfWeek, addDays, isSameDay, isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays, Ticket, ClipboardList, MapPin, Plus, FileText,
  Mic, MicOff, Bell, BellOff, ChevronLeft, ChevronRight,
  Calendar as CalIcon, LayoutList, Trash2, CheckCircle2,
} from 'lucide-react';
import { ServiceOrderDetailDialog } from '@/components/service-orders/ServiceOrderDetailDialog';
import { DailyServiceRecordDialog } from '@/components/daily-records/DailyServiceRecordDialog';
import { TicketDetailDialog } from '@/components/tickets/TicketDetailDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { AppointmentDialog } from '@/components/agenda/AppointmentDialog';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useAppointmentNotifications } from '@/hooks/useAppointmentNotifications';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ViewMode = 'day' | 'week' | 'month';

type AgendaItem = {
  id: string;
  rawId: string;
  type: 'os' | 'ticket' | 'atendimento' | 'visita' | 'appointment';
  title: string;
  company: string;
  time?: string;
  endTime?: string;
  status: string;
  priority?: string;
  details?: string;
  date: string;
};

const typeConfig = {
  os:          { label: 'Ordem de Serviço', color: 'bg-blue-500',    textColor: 'text-blue-600',    border: 'border-blue-400',    badge: 'default'     as const, icon: FileText    },
  ticket:      { label: 'Chamado',          color: 'bg-orange-500',  textColor: 'text-orange-600',  border: 'border-orange-400',  badge: 'secondary'   as const, icon: Ticket      },
  atendimento: { label: 'Atendimento',      color: 'bg-green-500',   textColor: 'text-green-600',   border: 'border-green-400',   badge: 'outline'     as const, icon: ClipboardList},
  visita:      { label: 'Visita',           color: 'bg-purple-500',  textColor: 'text-purple-600',  border: 'border-purple-400',  badge: 'destructive' as const, icon: MapPin      },
  appointment: { label: 'Compromisso',      color: 'bg-teal-500',    textColor: 'text-teal-600',    border: 'border-teal-400',    badge: 'outline'     as const, icon: CalendarDays},
};

const appointmentTypeEmoji: Record<string, string> = {
  reuniao: '👥', ligacao: '📞', visita: '🚗', compromisso: '📌', outro: '📋',
};

function parsePortugueseDateTime(text: string): { title: string; appointment_date?: string; appointment_time?: string } {
  const lower = text.toLowerCase().trim();
  const today = new Date();
  let date: Date | null = null;
  let time = '';
  let remaining = lower;

  const dateTests: [RegExp, () => Date][] = [
    [/\bhoje\b/,              () => today],
    [/\bamanh[ãa]\b/,        () => addDays(today, 1)],
    [/\bdepois de amanh[ãa]\b/, () => addDays(today, 2)],
    [/\bsegunda[-\s]?(feira)?\b/, () => { const d = new Date(today); d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 || 7)); return d; }],
    [/\bter[çc][ãa][-\s]?(feira)?\b/, () => { const d = new Date(today); d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7)); return d; }],
    [/\bquarta[-\s]?(feira)?\b/, () => { const d = new Date(today); d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7)); return d; }],
    [/\bquinta[-\s]?(feira)?\b/, () => { const d = new Date(today); d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7)); return d; }],
    [/\bsexta[-\s]?(feira)?\b/, () => { const d = new Date(today); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return d; }],
  ];
  for (const [pat, fn] of dateTests) {
    if (pat.test(remaining)) { date = fn(); remaining = remaining.replace(pat, ''); break; }
  }

  const diaMatch = remaining.match(/\bdia\s+(\d{1,2})(?:\/(\d{1,2}))?/);
  if (diaMatch) {
    const d = parseInt(diaMatch[1]), m = diaMatch[2] ? parseInt(diaMatch[2]) - 1 : today.getMonth();
    const candidate = new Date(today.getFullYear(), m, d);
    date = candidate >= today ? candidate : new Date(today.getFullYear() + 1, m, d);
    remaining = remaining.replace(diaMatch[0], '');
  }

  for (const pat of [/[àa]s?\s*(\d{1,2})[h:]\s*(\d{2})/, /[àa]s?\s*(\d{1,2})\s*(?:horas?|h)\b/, /\b(\d{1,2}):(\d{2})\b/, /\b(\d{1,2})h(\d{2})?\b/]) {
    const m = remaining.match(pat);
    if (m) {
      const h = parseInt(m[1]), min = m[2] ? parseInt(m[2]) : 0;
      if (h >= 0 && h <= 23) { time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`; remaining = remaining.replace(m[0], ''); break; }
    }
  }

  const title = remaining.replace(/\bpara\b|\bcom\b|\bde\b|\bdo\b|\bda\b|\bno\b|\bna\b|\bem\b/g, ' ').replace(/[,;.]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return { title: title || text, appointment_date: date ? format(date, 'yyyy-MM-dd') : undefined, appointment_time: time || undefined };
}

export default function Agenda() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedOS, setSelectedOS] = useState<any>(null);
  const [osDetailOpen, setOsDetailOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [appointmentPrefill, setAppointmentPrefill] = useState<any>(undefined);
  const [editAppointmentId, setEditAppointmentId] = useState<string | undefined>(undefined);
  const [notifEnabled, setNotifEnabled] = useState(false);

  // Notificações
  const { requestNotificationPermission } = useAppointmentNotifications(profile?.id);

  useEffect(() => {
    setNotifEnabled('Notification' in window && Notification.permission === 'granted');
  }, []);

  const handleEnableNotifications = async () => {
    const ok = await requestNotificationPermission();
    setNotifEnabled(ok);
    toast({ title: ok ? 'Notificações ativadas!' : 'Permissão negada', description: ok ? 'Você será avisado dos compromissos.' : 'Habilite nas configurações do navegador.' });
  };

  // Voice
  const { status: voiceStatus, startListening, stopListening, isSupported: voiceSupported } = useVoiceInput({
    onFinalResult: (raw) => {
      const parsed = parsePortugueseDateTime(raw);
      setAppointmentPrefill(parsed);
      setEditAppointmentId(undefined);
      setAppointmentDialogOpen(true);
      toast({ title: '🎤 Voz reconhecida', description: `"${raw}"` });
    },
    onError: (err) => toast({ title: 'Erro de voz', description: err, variant: 'destructive' }),
  });
  const isListening = voiceStatus === 'listening';

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  const { data: serviceOrders = [], refetch: refetchOS } = useQuery({
    queryKey: ['agenda-os', monthStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase.from('service_orders')
        .select('id, numero_os, descricao_servicos, status, prioridade, data_agendada, hora_agendada, modalidade, tipo_servico, companies:company_id(nome_fantasia)')
        .gte('data_agendada', monthStart.toISOString()).lte('data_agendada', monthEnd.toISOString())
        .in('status', ['agendada', 'confirmada', 'em_execucao']).order('data_agendada').limit(100);
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['agenda-tickets', monthStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase.from('tickets')
        .select('id, numero, titulo, status, prioridade, urgencia, created_at, companies:company_id(nome_fantasia)')
        .in('status', ['novo', 'em_atendimento']).order('created_at', { ascending: false }).limit(30);
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: dailyRecords = [], refetch: refetchDaily } = useQuery({
    queryKey: ['agenda-daily', monthStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase.from('daily_service_records')
        .select('id, titulo, descricao, status, data_atendimento, hora_inicio, hora_fim, canal, companies:company_id(nome_fantasia)')
        .gte('data_atendimento', format(monthStart, 'yyyy-MM-dd')).lte('data_atendimento', format(monthEnd, 'yyyy-MM-dd')).order('data_atendimento');
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: visitSchedules = [] } = useQuery({
    queryKey: ['agenda-visits', monthStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase.from('visit_schedules')
        .select('id, proxima_visita, motivo, status, prioridade, observacoes, companies:company_id(nome_fantasia)')
        .gte('proxima_visita', format(monthStart, 'yyyy-MM-dd')).lte('proxima_visita', format(monthEnd, 'yyyy-MM-dd')).order('proxima_visita');
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: appointments = [], refetch: refetchAppointments } = useQuery({
    queryKey: ['agenda-appointments', monthStart.toISOString(), profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('appointments')
        .select('*')
        .eq('user_id', profile.id)
        .gte('appointment_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('appointment_date', format(monthEnd, 'yyyy-MM-dd'))
        .neq('status', 'cancelado')
        .order('appointment_date').order('appointment_time');
      return data || [];
    },
    enabled: !!profile,
  });

  const allItems = useMemo<AgendaItem[]>(() => {
    const items: AgendaItem[] = [];
    serviceOrders.forEach((os: any) => {
      if (!os.data_agendada) return;
      items.push({ id: `os-${os.id}`, rawId: os.id, type: 'os', date: format(parseISO(os.data_agendada), 'yyyy-MM-dd'),
        title: `OS #${os.numero_os} - ${os.descricao_servicos?.substring(0, 60)}`,
        company: os.companies?.nome_fantasia || 'N/A', time: os.hora_agendada?.substring(0, 5),
        status: os.status, priority: os.prioridade, details: `${os.tipo_servico || 'corretivo'} / ${os.modalidade || 'presencial'}` });
    });
    tickets.forEach((t: any) => {
      items.push({ id: `ticket-${t.id}`, rawId: t.id, type: 'ticket', date: format(parseISO(t.created_at), 'yyyy-MM-dd'),
        title: `#${t.numero} - ${t.titulo}`, company: t.companies?.nome_fantasia || 'N/A',
        status: t.status, priority: t.prioridade, details: `Urgência: ${t.urgencia}` });
    });
    dailyRecords.forEach((r: any) => {
      items.push({ id: `daily-${r.id}`, rawId: r.id, type: 'atendimento', date: r.data_atendimento,
        title: r.titulo, company: r.companies?.nome_fantasia || 'N/A',
        time: r.hora_inicio?.substring(0, 5), endTime: r.hora_fim?.substring(0, 5),
        status: r.status, details: `Canal: ${r.canal}` });
    });
    visitSchedules.forEach((v: any) => {
      items.push({ id: `visit-${v.id}`, rawId: v.id, type: 'visita', date: v.proxima_visita,
        title: `Visita - ${v.motivo}`, company: v.companies?.nome_fantasia || 'N/A',
        status: v.status, priority: v.prioridade, details: v.observacoes?.substring(0, 60) });
    });
    appointments.forEach((a: any) => {
      const emoji = appointmentTypeEmoji[a.type] || '📌';
      items.push({ id: `appt-${a.id}`, rawId: a.id, type: 'appointment', date: a.appointment_date,
        title: `${emoji} ${a.title}`, company: '', time: a.appointment_time?.substring(0, 5),
        endTime: a.end_time?.substring(0, 5), status: a.status, details: a.description || undefined });
    });
    return items;
  }, [serviceOrders, tickets, dailyRecords, visitSchedules, appointments]);

  const datesWithItems = useMemo(() => {
    const map = new Map<string, Set<string>>();
    allItems.forEach((item) => {
      if (!map.has(item.date)) map.set(item.date, new Set());
      map.get(item.date)!.add(item.type);
    });
    return map;
  }, [allItems]);

  const getItemsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return allItems
      .filter((item) => item.date === dateStr && (activeFilter === 'all' || item.type === activeFilter))
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { locale: ptBR });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const selectedDateItems = useMemo(() => getItemsForDate(selectedDate), [allItems, selectedDate, activeFilter]);

  const handleItemClick = async (item: AgendaItem) => {
    if (item.type === 'os') {
      const { data: fullOS } = await supabase.from('service_orders')
        .select('*, companies:company_id(nome_fantasia), profiles:tecnico_id(nome), tickets:ticket_id(numero, titulo)')
        .eq('id', item.rawId).single();
      if (fullOS) { setSelectedOS(fullOS); setOsDetailOpen(true); }
    } else if (item.type === 'atendimento') {
      setSelectedRecordId(item.rawId);
    } else if (item.type === 'ticket') {
      navigate(`/tickets/${item.rawId}`);
    } else if (item.type === 'appointment') {
      const appt = appointments.find((a: any) => a.id === item.rawId);
      if (appt) {
        setAppointmentPrefill({
          title: appt.title, description: appt.description,
          appointment_date: appt.appointment_date, appointment_time: appt.appointment_time?.substring(0, 5),
          end_time: appt.end_time?.substring(0, 5), type: appt.type, notify_minutes: appt.notify_minutes,
        });
        setEditAppointmentId(appt.id);
        setAppointmentDialogOpen(true);
      }
    }
  };

  const handleDeleteAppointment = async (rawId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('appointments').update({ status: 'cancelado' }).eq('id', rawId);
    refetchAppointments();
    toast({ title: 'Compromisso removido' });
  };

  const handleCompleteAppointment = async (rawId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('appointments').update({ status: 'concluido' }).eq('id', rawId);
    refetchAppointments();
    toast({ title: 'Compromisso concluído! ✅' });
  };

  const priorityColor = (p?: string) =>
    p === 'alta' || p === 'critica' ? 'border-red-500 text-red-600' : p === 'media' ? 'border-yellow-500 text-yellow-600' : 'border-green-500 text-green-600';

  if (loading) return null;
  if (!profile) { navigate('/auth'); return null; }

  return (
    <TooltipProvider>
      <div className="bg-background min-h-screen">
        <PageHeader
          icon={CalendarDays}
          title="Agenda Unificada"
          subtitle="Todas as atividades consolidadas em uma visão"
          metrics={[
            { icon: FileText,     label: 'OS',           value: serviceOrders.length,  color: 'bg-blue-600/90'    },
            { icon: Ticket,       label: 'Chamados',     value: tickets.length,         color: 'bg-amber-600/90'   },
            { icon: ClipboardList,label: 'Atendimentos', value: dailyRecords.length,    color: 'bg-emerald-600/90' },
            { icon: CalendarDays, label: 'Compromissos', value: appointments.length,    color: 'bg-teal-600/90'    },
          ]}
          actions={
            <div className="flex gap-2 flex-wrap">
              {/* Notificações */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" className={cn('h-8 text-xs gap-1 border-0', notifEnabled ? 'bg-teal-500/80 hover:bg-teal-500/60 text-white' : 'bg-white/10 hover:bg-white/20 text-white')}
                    onClick={handleEnableNotifications}>
                    {notifEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{notifEnabled ? 'Notif. ON' : 'Ativar Avisos'}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{notifEnabled ? 'Notificações ativas' : 'Ativar notificações de compromissos'}</TooltipContent>
              </Tooltip>

              {/* Voz */}
              {voiceSupported && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm"
                      className={cn('h-8 text-xs gap-1 border-0', isListening ? 'bg-red-500/80 hover:bg-red-500/60 text-white animate-pulse' : 'bg-white/10 hover:bg-white/20 text-white')}
                      onClick={isListening ? stopListening : () => startListening()}>
                      {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{isListening ? 'Ouvindo...' : 'Voz'}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Criar compromisso por voz</TooltipContent>
                </Tooltip>
              )}

              <Button size="sm" className="h-8 text-xs gap-1 bg-teal-500/80 hover:bg-teal-500/60 text-white border-0"
                onClick={() => { setAppointmentPrefill({ appointment_date: format(selectedDate, 'yyyy-MM-dd') }); setEditAppointmentId(undefined); setAppointmentDialogOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Compromisso</span>
              </Button>

              <Button size="sm" className="h-8 text-xs gap-1 bg-white/10 hover:bg-white/20 text-white border-0"
                onClick={() => navigate('/service-orders/new')}>
                <Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Nova OS</span>
              </Button>
            </div>
          }
        />

        <main className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Calendário */}
            <Card className="lg:col-span-1">
              <CardContent className="p-4">
                <Calendar
                  mode="single" selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  locale={ptBR} className="w-full"
                  modifiers={{
                    hasOs:          (d) => datesWithItems.has(format(d, 'yyyy-MM-dd')) && !!datesWithItems.get(format(d, 'yyyy-MM-dd'))?.has('os'),
                    hasAtendimento: (d) => datesWithItems.has(format(d, 'yyyy-MM-dd')) && !!datesWithItems.get(format(d, 'yyyy-MM-dd'))?.has('atendimento'),
                    hasVisita:      (d) => datesWithItems.has(format(d, 'yyyy-MM-dd')) && !!datesWithItems.get(format(d, 'yyyy-MM-dd'))?.has('visita'),
                    hasAppointment: (d) => datesWithItems.has(format(d, 'yyyy-MM-dd')) && !!datesWithItems.get(format(d, 'yyyy-MM-dd'))?.has('appointment'),
                  }}
                  modifiersStyles={{
                    hasOs:          { borderBottom: '3px solid hsl(217,91%,60%)' },
                    hasAtendimento: { borderBottom: '3px solid hsl(142,71%,45%)' },
                    hasVisita:      { borderBottom: '3px solid hsl(271,91%,65%)' },
                    hasAppointment: { outline: '2px solid hsl(174,72%,45%)', outlineOffset: '1px', borderRadius: '4px' },
                  }}
                />
                {/* Legenda */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(typeConfig).map(([key, cfg]) => (
                    <button key={key}
                      className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors', activeFilter === key ? 'bg-accent font-semibold' : 'hover:bg-accent/50')}
                      onClick={() => setActiveFilter(activeFilter === key ? 'all' : key)}>
                      <div className={`w-2.5 h-2.5 rounded-full ${cfg.color}`} />
                      <span>{cfg.label}</span>
                    </button>
                  ))}
                  <button className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md col-span-2 transition-colors', activeFilter === 'all' ? 'bg-accent font-semibold' : 'hover:bg-accent/50')}
                    onClick={() => setActiveFilter('all')}>
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                    <span>Todos os tipos</span>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Painel principal */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setSelectedDate(d => addDays(d, viewMode === 'week' ? -7 : -1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle className="text-base">
                      {viewMode === 'week'
                        ? `${format(weekDays[0], "d MMM", { locale: ptBR })} – ${format(weekDays[6], "d MMM", { locale: ptBR })}`
                        : format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                      {isToday(selectedDate) && viewMode === 'day' && (
                        <Badge className="ml-2 text-xs bg-teal-500">Hoje</Badge>
                      )}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setSelectedDate(d => addDays(d, viewMode === 'week' ? 7 : 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* View switcher */}
                  <div className="flex gap-1 bg-muted rounded-lg p-1">
                    {(['day', 'week'] as ViewMode[]).map((v) => (
                      <Button key={v} size="sm" variant={viewMode === v ? 'default' : 'ghost'} className="h-6 text-xs px-2"
                        onClick={() => setViewMode(v)}>
                        {v === 'day' ? <><LayoutList className="h-3 w-3 mr-1" />Dia</> : <><CalIcon className="h-3 w-3 mr-1" />Semana</>}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {viewMode === 'day' && (
                  selectedDateItems.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <CalendarDays className="h-14 w-14 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">Nenhuma atividade para este dia</p>
                      <p className="text-xs mt-1">Clique em "+ Compromisso" ou use o microfone para adicionar</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedDateItems.map((item) => <AgendaCard key={item.id} item={item} onClick={() => handleItemClick(item)}
                        onDelete={item.type === 'appointment' ? (e) => handleDeleteAppointment(item.rawId, e) : undefined}
                        onComplete={item.type === 'appointment' ? (e) => handleCompleteAppointment(item.rawId, e) : undefined}
                        priorityColor={priorityColor} />)}
                    </div>
                  )
                )}

                {viewMode === 'week' && (
                  <div className="grid grid-cols-7 gap-1 min-h-[400px]">
                    {weekDays.map((day) => {
                      const dayItems = getItemsForDate(day);
                      const isSelected = isSameDay(day, selectedDate);
                      const todayDay = isToday(day);
                      return (
                        <div key={day.toISOString()}
                          className={cn('rounded-lg border p-1.5 cursor-pointer transition-colors min-h-[120px]', isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/30', todayDay && !isSelected && 'border-teal-400 bg-teal-50/50 dark:bg-teal-950/20')}
                          onClick={() => { setSelectedDate(day); setViewMode('day'); }}>
                          <div className={cn('text-center text-xs font-semibold mb-1', todayDay ? 'text-teal-600' : 'text-muted-foreground')}>
                            {format(day, 'EEE', { locale: ptBR })}<br />
                            <span className={cn('text-sm', todayDay && 'bg-teal-500 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto')}>{format(day, 'd')}</span>
                          </div>
                          <div className="space-y-0.5">
                            {dayItems.slice(0, 3).map((item) => {
                              const cfg = typeConfig[item.type];
                              return (
                                <div key={item.id} className={cn('text-[10px] px-1 py-0.5 rounded truncate text-white', cfg.color)}>
                                  {item.time && <span className="opacity-80">{item.time} </span>}{item.title.replace(/^[^\w\s]*\s/, '')}
                                </div>
                              );
                            })}
                            {dayItems.length > 3 && <div className="text-[10px] text-muted-foreground text-center">+{dayItems.length - 3}</div>}
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

        {osDetailOpen && selectedOS && (
          <ServiceOrderDetailDialog serviceOrder={selectedOS} open={osDetailOpen} onOpenChange={setOsDetailOpen}
            onUpdate={() => { refetchOS(); setOsDetailOpen(false); setSelectedOS(null); }} />
        )}
        {selectedRecordId && (
          <DailyServiceRecordDialog open={true} onOpenChange={(open) => { if (!open) setSelectedRecordId(null); }}
            recordId={selectedRecordId} onSuccess={() => { refetchDaily(); setSelectedRecordId(null); }} />
        )}
        <AppointmentDialog
          open={appointmentDialogOpen}
          onOpenChange={setAppointmentDialogOpen}
          onSuccess={() => { refetchAppointments(); setAppointmentPrefill(undefined); setEditAppointmentId(undefined); }}
          prefill={appointmentPrefill}
          editId={editAppointmentId}
        />
      </div>
    </TooltipProvider>
  );
}

function AgendaCard({ item, onClick, onDelete, onComplete, priorityColor }: {
  item: AgendaItem;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  onComplete?: (e: React.MouseEvent) => void;
  priorityColor: (p?: string) => string;
}) {
  const cfg = typeConfig[item.type];
  const Icon = cfg.icon;
  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-xl border-l-4 bg-card hover:bg-accent/40 transition-all cursor-pointer shadow-sm group', cfg.border)}
      onClick={onClick}>
      <div className={cn('p-2 rounded-lg text-white shrink-0 mt-0.5', cfg.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          {item.time && (
            <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              {item.time}{item.endTime ? `–${item.endTime}` : ''}
            </span>
          )}
          <Badge variant="outline" className={cn('text-xs', cfg.textColor, cfg.border)}>{cfg.label}</Badge>
          {item.priority && <Badge variant="outline" className={cn('text-xs', priorityColor(item.priority))}>{item.priority}</Badge>}
          <Badge variant="outline" className="text-xs ml-auto">{item.status}</Badge>
        </div>
        <p className="text-sm font-medium truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          {item.company && <span>🏢 {item.company}</span>}
          {item.details && <span className="truncate">• {item.details}</span>}
        </div>
      </div>
      {(onDelete || onComplete) && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {onComplete && (
            <button className="p-1 rounded hover:bg-green-100 text-green-600" onClick={onComplete} title="Concluir">
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button className="p-1 rounded hover:bg-red-100 text-red-500" onClick={onDelete} title="Cancelar">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
