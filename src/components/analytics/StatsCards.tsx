import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsStats } from '@/hooks/useAnalyticsData';
import { 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Folder, 
  Timer,
  ShieldCheck,
  ShieldAlert,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  stats: AnalyticsStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total de Chamados',
      value: stats.total_tickets,
      icon: Ticket,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      title: 'Em Aberto',
      value: stats.tickets_abertos,
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50'
    },
    {
      title: 'Resolvidos',
      value: stats.tickets_resolvidos,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      title: 'Taxa de Resolução',
      value: `${stats.taxa_resolucao}%`,
      icon: Timer,
      color: stats.taxa_resolucao >= 70 ? 'text-green-600' : stats.taxa_resolucao >= 50 ? 'text-yellow-600' : 'text-red-600',
      bg: stats.taxa_resolucao >= 70 ? 'bg-green-50' : stats.taxa_resolucao >= 50 ? 'bg-yellow-50' : 'bg-red-50'
    },
    {
      title: 'Tempo Médio Resposta',
      value: `${stats.tempo_medio_resposta_horas}h`,
      icon: Clock,
      color: stats.tempo_medio_resposta_horas <= 4 ? 'text-green-600' : stats.tempo_medio_resposta_horas <= 8 ? 'text-yellow-600' : 'text-red-600',
      bg: stats.tempo_medio_resposta_horas <= 4 ? 'bg-green-50' : stats.tempo_medio_resposta_horas <= 8 ? 'bg-yellow-50' : 'bg-red-50'
    },
    {
      title: 'SLA Cumprido',
      value: stats.sla_cumprido,
      icon: ShieldCheck,
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      title: 'SLA Violado',
      value: stats.sla_violado,
      icon: ShieldAlert,
      color: stats.sla_violado === 0 ? 'text-green-600' : 'text-red-600',
      bg: stats.sla_violado === 0 ? 'bg-green-50' : 'bg-red-50'
    },
    {
      title: 'Sem Categoria',
      value: stats.tickets_sem_categoria,
      icon: Folder,
      color: stats.tickets_sem_categoria === 0 ? 'text-green-600' : 'text-yellow-600',
      bg: stats.tickets_sem_categoria === 0 ? 'bg-green-50' : 'bg-yellow-50'
    },
    {
      title: 'Clientes Negligenciados',
      value: stats.empresas_negligenciadas,
      icon: Building2,
      color: stats.empresas_negligenciadas === 0 ? 'text-green-600' : 'text-red-600',
      bg: stats.empresas_negligenciadas === 0 ? 'bg-green-50' : 'bg-red-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={cn('p-2 rounded-lg', card.bg)}>
                <Icon className={cn('h-4 w-4', card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-bold', card.color)}>
                {card.value}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
