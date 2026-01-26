import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { AppHeader } from '@/components/layout/AppHeader';
import { StatsCards } from '@/components/analytics/StatsCards';
import { TrendChart } from '@/components/analytics/TrendChart';
import { CategoryPieChart } from '@/components/analytics/CategoryPieChart';
import { CompanyHealthTable } from '@/components/analytics/CompanyHealthTable';
import { NeglectedCompaniesAlert } from '@/components/analytics/NeglectedCompaniesAlert';
import { HealthScoreIndicator } from '@/components/analytics/HealthScoreIndicator';
import { VisitPlannerCard } from '@/components/analytics/VisitPlannerCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, BarChart3 } from 'lucide-react';

export default function Analytics() {
  const navigate = useNavigate();
  const { profile, loading: authLoading, isAdmin } = useAuth();
  const { 
    stats, 
    companyHealth, 
    trendData, 
    categoryDistribution, 
    neglectedCompanies,
    loading, 
    error,
    refresh 
  } = useAnalyticsData();

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/auth');
    } else if (!authLoading && profile && !isAdmin()) {
      navigate('/dashboard');
    }
  }, [profile, authLoading, navigate, isAdmin]);

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-96 w-full max-w-md" />
      </div>
    );
  }

  // Calculate overall health score
  const overallHealthScore = companyHealth.length > 0
    ? Math.round(companyHealth.reduce((acc, c) => acc + c.health_score, 0) / companyHealth.length)
    : 100;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold">Centro de Comando</h1>
            </div>
            <p className="text-muted-foreground">Visão analítica do seu suporte</p>
          </div>
          <div className="flex items-center gap-4">
            <Card className="px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Saúde Geral:</span>
                <HealthScoreIndicator score={overallHealthScore} size="md" />
              </div>
            </Card>
            <Button 
              onClick={refresh} 
              variant="outline" 
              size="icon"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {error && (
          <Card className="mb-6 border-destructive bg-destructive/10">
            <CardContent className="py-4">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-[350px]" />
              <Skeleton className="h-[350px]" />
            </div>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* AI Visit Planner + Neglected Companies Alert */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <VisitPlannerCard neglectedCompanies={neglectedCompanies} />
              <NeglectedCompaniesAlert companies={neglectedCompanies} />
            </div>

            {/* Stats Cards */}
            <StatsCards stats={stats} />

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrendChart data={trendData} />
              <CategoryPieChart data={categoryDistribution} />
            </div>

            {/* Company Health Table */}
            <CompanyHealthTable 
              companies={companyHealth} 
              title="Mapa de Saúde das Empresas (Ordenado por Criticidade)"
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
