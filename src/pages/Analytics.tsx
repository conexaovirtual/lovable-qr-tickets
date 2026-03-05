import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { StatsCards } from '@/components/analytics/StatsCards';
import { TrendChart } from '@/components/analytics/TrendChart';
import { CategoryPieChart } from '@/components/analytics/CategoryPieChart';
import { CompanyHealthTable } from '@/components/analytics/CompanyHealthTable';
import { NeglectedCompaniesAlert } from '@/components/analytics/NeglectedCompaniesAlert';
import { HealthScoreIndicator } from '@/components/analytics/HealthScoreIndicator';
import { VisitPlannerCard } from '@/components/analytics/VisitPlannerCard';
import { PredictiveMaintenanceCard } from '@/components/ai/PredictiveMaintenanceCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, BarChart3, Ticket, Building2, Clock, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

export default function Analytics() {
  const navigate = useNavigate();
  const { profile, loading: authLoading, isAdmin } = useAuth();
  const { stats, companyHealth, trendData, categoryDistribution, neglectedCompanies, loading, error, refresh } = useAnalyticsData();

  useEffect(() => {
    if (!authLoading && !profile) navigate('/auth');
    else if (!authLoading && profile && !isAdmin()) navigate('/dashboard');
  }, [profile, authLoading, navigate, isAdmin]);

  if (authLoading || !profile) return <div className="min-h-screen bg-background flex items-center justify-center"><Skeleton className="h-96 w-full max-w-md" /></div>;

  const overallHealthScore = companyHealth.length > 0
    ? Math.round(companyHealth.reduce((acc, c) => acc + c.health_score, 0) / companyHealth.length) : 100;

  return (
    <div className="bg-background min-h-screen">
      <PageHeader
        icon={BarChart3}
        title="Centro de Comando"
        subtitle="Visão analítica do seu suporte"
        metrics={stats ? [
          { icon: Ticket, label: "Chamados", value: stats.total_tickets, color: "bg-blue-600/90" },
          { icon: Building2, label: "Empresas", value: companyHealth.length, color: "bg-emerald-600/90" },
          { icon: Clock, label: "Abertos", value: stats.tickets_abertos, color: "bg-amber-600/90" },
          { icon: CheckCircle2, label: "Resolvidos", value: stats.tickets_resolvidos, color: "bg-teal-600/90" },
        ] : undefined}
        actions={
          <Button onClick={refresh} variant="ghost" size="icon" disabled={loading}
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <main className="container mx-auto px-4 py-4">
        {error && (
          <Card className="mb-4 border-destructive bg-destructive/10">
            <CardContent className="py-4"><p className="text-destructive">{error}</p></CardContent>
          </Card>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24" />)}
            </div>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <PredictiveMaintenanceCard />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <VisitPlannerCard neglectedCompanies={neglectedCompanies} />
              <NeglectedCompaniesAlert companies={neglectedCompanies} />
            </div>
            <StatsCards stats={stats} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrendChart data={trendData} />
              <CategoryPieChart data={categoryDistribution} />
            </div>
            <CompanyHealthTable companies={companyHealth} title="Mapa de Saúde das Empresas (Ordenado por Criticidade)" />
          </div>
        ) : null}
      </main>
    </div>
  );
}
