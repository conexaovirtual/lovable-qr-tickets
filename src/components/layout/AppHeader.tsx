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
import { Menu, User, LogOut, LayoutDashboard, Ticket, Package, Building2, Wrench, FileBarChart, PackageSearch, ClipboardList } from 'lucide-react';

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

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

            <nav className="hidden md:flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link to="/tickets">
                <Button variant="ghost" size="sm">
                  <Ticket className="h-4 w-4 mr-2" />
                  Chamados
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
              {(profile.roles?.includes('admin_provedor') || profile.roles?.includes('tecnico')) && (
                <Link to="/daily-services">
                  <Button variant="ghost" size="sm">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Atendimentos Diários
                  </Button>
                </Link>
              )}
              {profile.roles?.includes('admin_provedor') && (
                <>
                  <Link to="/companies">
                    <Button variant="ghost" size="sm">
                      <Building2 className="h-4 w-4 mr-2" />
                      Empresas
                    </Button>
                  </Link>
                  <Link to="/technicians">
                    <Button variant="ghost" size="sm">
                      <Wrench className="h-4 w-4 mr-2" />
                      Técnicos
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
                <DropdownMenuItem onClick={() => navigate('/tickets')}>
                  <Ticket className="h-4 w-4 mr-2" />
                  Chamados
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/assets')}>
                  <Package className="h-4 w-4 mr-2" />
                  Ativos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/inventory')}>
                  <PackageSearch className="h-4 w-4 mr-2" />
                  Inventário
                </DropdownMenuItem>
                {(profile.roles?.includes('admin_provedor') || profile.roles?.includes('tecnico')) && (
                  <DropdownMenuItem onClick={() => navigate('/daily-services')}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Atendimentos Diários
                  </DropdownMenuItem>
                )}
                {profile.roles?.includes('admin_provedor') && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/companies')}>
                      <Building2 className="h-4 w-4 mr-2" />
                      Empresas
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/technicians')}>
                      <Wrench className="h-4 w-4 mr-2" />
                      Técnicos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/reports')}>
                      <FileBarChart className="h-4 w-4 mr-2" />
                      Relatórios
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
