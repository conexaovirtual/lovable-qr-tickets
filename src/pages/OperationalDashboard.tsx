import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  CalendarDays,
  Wifi,
  WifiOff,
  AlertTriangle,
  Ticket,
  TrendingUp,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';
import { useOperationalDashboard, PeriodFilter } from '@/hooks/useOperationalDashboard';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(142.1, 76.2%, 36.3%)',
  'hsl(var(--destructive))',
  'hsl(47.9, 95.8%, 53.1%)',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
];

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '14d', label: '14 dias' },
  { value: '30d', label: '30 dias' },
];

function KPICard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OperationalDashboard() {
  const [period, setPeriod] = useState<PeriodFilter>('14d');
  const queryClient = useQueryClient();
  const { isLoading, kpis, charts } = useOperationalDashboard(period);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['op-dashboard-records'] });
    queryClient.invalidateQueries({ queryKey: ['op-dashboard-tickets'] });
    queryClient.invalidateQueries({ queryKey: ['op-dashboard-assets'] });
  };

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={Activity}
        title="Painel Operacional"
        subtitle="Visão geral do negócio em tempo real"
        actions={
          <div className="flex items-center gap-2">
            {PERIOD_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                size="sm"
                variant={period === opt.value ? 'default' : 'outline'}
                onClick={() => setPeriod(opt.value)}
                className={period !== opt.value ? 'border-white/20 text-white hover:bg-white/10' : ''}
              >
                {opt.label}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={handleRefresh} className="border-white/20 text-white hover:bg-white/10">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
        metrics={[
          { icon: ClipboardList, label: 'Hoje', value: kpis.attendancesToday, color: 'bg-primary' },
          { icon: Wifi, label: 'Online', value: kpis.onlineDevices, color: 'bg-emerald-600' },
          { icon: WifiOff, label: 'Offline', value: kpis.offlineDevices, color: 'bg-red-600' },
        ]}
      />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KPICard icon={ClipboardList} label="Atend. Hoje" value={kpis.attendancesToday} color="bg-primary" />
              <KPICard icon={CalendarDays} label="Atend. Semana" value={kpis.attendancesWeek} color="bg-blue-600" />
              <KPICard icon={Wifi} label="Dispositivos Online" value={kpis.onlineDevices} color="bg-emerald-600" />
              <KPICard icon={WifiOff} label="Dispositivos Offline" value={kpis.offlineDevices} color="bg-red-600" />
              <KPICard icon={Ticket} label="Chamados Abertos" value={kpis.openTickets} color="bg-amber-600" />
              <KPICard icon={TrendingUp} label="Taxa Resolução" value={`${kpis.resolutionRate}%`} color="bg-emerald-700" />
            </div>

            {/* Row 1: Atendimentos por dia + Problemas recorrentes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Atendimentos por Dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.attendanceByDay}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="atendimentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Problemas Recorrentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    {charts.topProblems.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={charts.topProblems}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name.slice(0, 12)}${name.length > 12 ? '…' : ''} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {charts.topProblems.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Top empresas + Distribuição por canal */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Top 10 Empresas por Atendimentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.topCompanies} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={120} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="value" fill="hsl(199, 89%, 48%)" radius={[0, 4, 4, 0]} name="Atendimentos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Distribuição por Canal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    {charts.channelDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={charts.channelDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {charts.channelDistribution.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 3: Tendência semanal + Dispositivos por empresa */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Tendência Semanal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts.weeklyTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="semana" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Line type="monotone" dataKey="atendimentos" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} name="Atendimentos" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Dispositivos por Empresa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    {charts.devicesByCompany.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.devicesByCompany} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={120} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend />
                          <Bar dataKey="online" stackId="a" fill="hsl(142.1, 76.2%, 36.3%)" name="Online" />
                          <Bar dataKey="offline" stackId="a" fill="hsl(var(--destructive))" name="Offline" />
                          <Bar dataKey="alert" stackId="a" fill="hsl(47.9, 95.8%, 53.1%)" name="Alerta" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dispositivos monitorados</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
