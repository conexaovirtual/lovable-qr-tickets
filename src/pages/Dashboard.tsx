import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ticket, Package, Users, BarChart3, Plus, LogOut } from 'lucide-react';

export default function Dashboard() {
  const { user, loading, profile, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = profile?.role === 'admin_provedor';
  const isTech = profile?.role === 'tecnico';
  const isManager = profile?.role === 'gestor_cliente';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-primary rounded-lg">
                <Ticket className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Help Desk TI</h1>
                <p className="text-sm text-muted-foreground">
                  Olá, {profile?.nome}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
          <p className="text-muted-foreground">
            Gerencie chamados, ativos e muito mais
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="hover:shadow-md transition-shadow cursor-pointer bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Novo Chamado
              </CardTitle>
              <Plus className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                Abrir Chamado
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Meus Chamados
              </CardTitle>
              <Ticket className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Chamados abertos
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Ativos
              </CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Equipamentos cadastrados
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Relatórios
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Ver Métricas
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Chamados Recentes</CardTitle>
              <CardDescription>
                Últimos chamados criados ou atualizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum chamado encontrado</p>
                <p className="text-sm">Abra seu primeiro chamado!</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SLA e Prioridades</CardTitle>
              <CardDescription>
                Acompanhe prazos e urgências
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                  <div>
                    <p className="font-medium text-success">Dentro do SLA</p>
                    <p className="text-sm text-muted-foreground">0 chamados</p>
                  </div>
                  <div className="text-2xl font-bold text-success">100%</div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <div>
                    <p className="font-medium text-warning">Em Risco</p>
                    <p className="text-sm text-muted-foreground">0 chamados</p>
                  </div>
                  <div className="text-2xl font-bold text-warning">0%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin/Tech Only Sections */}
        {(isAdmin || isTech || isManager) && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Gestão Rápida</CardTitle>
                <CardDescription>
                  Acesso rápido a funções administrativas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {(isAdmin || isManager) && (
                    <Button variant="outline" className="h-auto py-4">
                      <Users className="mr-2 h-5 w-5" />
                      Gerenciar Usuários
                    </Button>
                  )}
                  {(isAdmin || isTech || isManager) && (
                    <Button variant="outline" className="h-auto py-4">
                      <Package className="mr-2 h-5 w-5" />
                      Cadastrar Ativo
                    </Button>
                  )}
                  {isAdmin && (
                    <Button variant="outline" className="h-auto py-4">
                      <BarChart3 className="mr-2 h-5 w-5" />
                      Configurações
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
