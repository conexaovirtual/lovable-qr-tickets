import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/layout/AppHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Package,
  Plus
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    novos: 0,
    em_atendimento: 0,
    resolvidos: 0,
    violados: 0,
    ativos: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[Dashboard] Auth loading:', authLoading, 'Profile:', profile);
    }
    
    if (!authLoading && !profile) {
      if (import.meta.env.DEV) {
        console.log('[Dashboard] No profile found, redirecting to /auth');
      }
      navigate('/auth');
    } else if (profile) {
      if (import.meta.env.DEV) {
        console.log('[Dashboard] Profile loaded, loading dashboard data');
      }
      loadDashboardData();
    }
  }, [profile, authLoading, navigate]);

  const loadDashboardData = async () => {
    setLoading(true);

    // Carregar estatísticas de chamados
    const { data: tickets } = await supabase
      .from('tickets')
      .select('status, sla_solucao_limite');

    if (tickets) {
      const now = new Date();
      setStats({
        total: tickets.length,
        novos: tickets.filter(t => t.status === 'novo').length,
        em_atendimento: tickets.filter(t => t.status === 'em_atendimento').length,
        resolvidos: tickets.filter(t => t.status === 'resolvido' || t.status === 'fechado').length,
        violados: tickets.filter(t => {
          if (!t.sla_solucao_limite) return false;
          return new Date(t.sla_solucao_limite) < now && !['resolvido', 'fechado'].includes(t.status);
        }).length,
        ativos: 0,
      });
    }

    // Carregar ativos
    const { data: assets } = await supabase
      .from('assets')
      .select('id');
    
    if (assets) {
      setStats(prev => ({ ...prev, ativos: assets.length }));
    }

    // Carregar chamados recentes
    const { data: recent } = await supabase
      .from('tickets')
      .select('id, numero, titulo, status, prioridade, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recent) setRecentTickets(recent);

    setLoading(false);
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total de Chamados</CardTitle>
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <p className="text-xs text-muted-foreground">Todos os chamados</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Novos</CardTitle>
                  <AlertCircle className="h-4 w-4 text-info" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.novos}</div>
                  <p className="text-xs text-muted-foreground">Aguardando triagem</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
                  <Clock className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.em_atendimento}</div>
                  <p className="text-xs text-muted-foreground">Sendo atendidos</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Resolvidos</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.resolvidos}</div>
                  <p className="text-xs text-muted-foreground">Concluídos</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow border-destructive/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">SLA Violado</CardTitle>
                  <TrendingUp className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{stats.violados}</div>
                  <p className="text-xs text-muted-foreground">Fora do prazo</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Ativos</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.ativos}</div>
                  <p className="text-xs text-muted-foreground">Equipamentos cadastrados</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Chamados Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentTickets.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum chamado recente
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {recentTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-muted-foreground">
                                #{ticket.numero}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary capitalize">
                                {ticket.status.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-sm font-medium truncate">{ticket.titulo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button onClick={() => navigate('/tickets/new')} className="w-full justify-start">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Chamado
                  </Button>
                  <Button onClick={() => navigate('/tickets')} variant="outline" className="w-full justify-start">
                    <Ticket className="h-4 w-4 mr-2" />
                    Ver Todos os Chamados
                  </Button>
                  <Button onClick={() => navigate('/assets')} variant="outline" className="w-full justify-start">
                    <Package className="h-4 w-4 mr-2" />
                    Gerenciar Ativos
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
