import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, User, LogOut, LayoutDashboard, Package, Building2, Wrench, FileBarChart, PackageSearch, ClipboardList, FileText, Ticket, BarChart3, BookOpen, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  // Query para contar tickets novos via QR code
  const { data: newTicketsCount = 0 } = useQuery({
    queryKey: ['new-qrcode-tickets-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('public_request', true)
        .eq('status', 'novo');
      return count || 0;
    },
    enabled: !!profile && (profile.roles?.includes('admin_provedor') || profile.roles?.includes('tecnico')),
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  if (!profile) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-3">
              <img 
                src="/logo-conexaovirtual.png" 
                alt="Conexão Virtual" 
                className="h-10 w-auto"
                style={{ objectFit: 'contain' }}
              />
              <div className="hidden md:flex flex-col">
                <span className="font-semibold text-sm leading-tight">Conexão Virtual</span>
                <span className="text-xs text-muted-foreground">Help Desk TI</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-2 overflow-x-auto max-w-[calc(100vw-320px)] scrollbar-none">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              {(profile.roles?.includes('admin_provedor') || profile.roles?.includes('tecnico')) && (
                <>
                  <Link to="/tickets">
                    <Button variant="ghost" size="sm" className="relative">
                      <Ticket className="h-4 w-4 mr-2" />
                      Chamados
                      {newTicketsCount > 0 && (
                        <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1 text-xs">
                          {newTicketsCount}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                  <Link to="/daily-services">
                    <Button variant="ghost" size="sm">
                      <ClipboardList className="h-4 w-4 mr-2" />
                      Atendimentos
                    </Button>
                  </Link>
                  <Link to="/companies">
                    <Button variant="ghost" size="sm">
                      <Building2 className="h-4 w-4 mr-2" />
                      Empresas
                    </Button>
                  </Link>
                  <Link to="/reports">
                    <Button variant="ghost" size="sm">
                      <FileBarChart className="h-4 w-4 mr-2" />
                      Relatórios
                    </Button>
                  </Link>
                </>
              )}
              <Link to="/reports?tab=service-orders">
                <Button variant="ghost" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Ordens de Serviço
                </Button>
              </Link>
              <Link to="/assets">
                <Button variant="ghost" size="sm">
                  <Package className="h-4 w-4 mr-2" />
                  Ativos
                </Button>
              </Link>
              <Link to="/inventory">
                <Button variant="ghost" size="sm">
                  <PackageSearch className="h-4 w-4 mr-2" />
                  Inventário
                </Button>
              </Link>
              <Link to="/knowledge-base">
                <Button variant="ghost" size="sm">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Base de Conhecimento
                </Button>
              </Link>
              {(profile.roles?.includes('admin_provedor') || profile.roles?.includes('tecnico')) && (
                <Link to="/whatsapp-platform">
                  <Button variant="ghost" size="sm">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </Link>
              )}
              {profile.roles?.includes('admin_provedor') && (
                <>
                  <Link to="/analytics">
                    <Button variant="ghost" size="sm">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Analytics
                    </Button>
                  </Link>
                  <Link to="/technicians">
                    <Button variant="ghost" size="sm">
                      <Wrench className="h-4 w-4 mr-2" />
                      Técnicos
                    </Button>
                  </Link>
                </>
              )}
              {profile.roles?.includes('gestor_cliente') && (
                <Link to="/reports">
                  <Button variant="ghost" size="sm">
                    <FileBarChart className="h-4 w-4 mr-2" />
                    Relatórios
                  </Button>
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </DropdownMenuItem>
                {(profile.roles?.includes('admin_provedor') || profile.roles?.includes('tecnico')) && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/tickets')} className="relative">
                      <Ticket className="h-4 w-4 mr-2" />
                      Chamados
                      {newTicketsCount > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-xs">
                          {newTicketsCount}
                        </Badge>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/daily-services')}>
                      <ClipboardList className="h-4 w-4 mr-2" />
                      Atendimentos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/companies')}>
                      <Building2 className="h-4 w-4 mr-2" />
                      Empresas
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/reports')}>
                      <FileBarChart className="h-4 w-4 mr-2" />
                      Relatórios
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onClick={() => navigate('/reports?tab=service-orders')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Ordens de Serviço
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/assets')}>
                  <Package className="h-4 w-4 mr-2" />
                  Ativos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/inventory')}>
                  <PackageSearch className="h-4 w-4 mr-2" />
                  Inventário
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/knowledge-base')}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Base de Conhecimento
                </DropdownMenuItem>
                {(profile.roles?.includes('admin_provedor') || profile.roles?.includes('tecnico')) && (
                  <DropdownMenuItem onClick={() => navigate('/whatsapp-platform')}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    WhatsApp
                  </DropdownMenuItem>
                )}
                {profile.roles?.includes('admin_provedor') && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/analytics')}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Analytics
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/technicians')}>
                      <Wrench className="h-4 w-4 mr-2" />
                      Técnicos
                    </DropdownMenuItem>
                  </>
                )}
                {profile.roles?.includes('gestor_cliente') && (
                  <DropdownMenuItem onClick={() => navigate('/reports')}>
                    <FileBarChart className="h-4 w-4 mr-2" />
                    Relatórios
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{profile.nome}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{profile.nome}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {profile.roles?.[0]?.replace(/_/g, ' ') || 'Usuário'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
