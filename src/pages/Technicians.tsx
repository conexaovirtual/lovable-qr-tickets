import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { TechnicianList } from '@/components/technicians/TechnicianList';
import { TechnicianDialog } from '@/components/technicians/TechnicianDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Users, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Technicians() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0 });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !profile) {
      navigate('/auth');
      return;
    }

    if (profile && !profile.roles?.includes('admin_provedor') && !profile.roles?.includes('gestor_cliente')) {
      navigate('/dashboard');
      toast.error('Acesso negado');
      return;
    }

    if (profile) {
      loadTechnicians();
    }
  }, [profile, loading, navigate]);

  const loadTechnicians = async () => {
    try {
      setLoadingData(true);
      
      let query = supabase
        .from('profiles')
        .select(`
          *,
          company:companies(nome_fantasia),
          roles:user_roles(role)
        `)
        .order('nome');

      // Filter technicians by role
      const { data: technicianRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'tecnico');

      if (technicianRoles && technicianRoles.length > 0) {
        const technicianIds = technicianRoles.map(r => r.user_id);
        query = query.in('id', technicianIds);
      } else {
        // No technicians found
        setTechnicians([]);
        setStats({ total: 0, active: 0 });
        setLoadingData(false);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;

      setTechnicians(data || []);
      setStats({
        total: data?.length || 0,
        active: data?.length || 0, // Simplified - can add inactive logic later
      });
    } catch (error: any) {
      console.error('Error loading technicians:', error);
      toast.error('Erro ao carregar técnicos');
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Wrench className="h-8 w-8 text-primary" />
              Técnicos
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os técnicos do sistema
            </p>
          </div>
          
          {profile.roles?.includes('admin_provedor') && (
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Técnico
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Técnicos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Técnicos Ativos</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>
        </div>

        <TechnicianList 
          technicians={technicians} 
          loading={loadingData}
          onRefresh={loadTechnicians}
        />
      </main>

      <TechnicianDialog 
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={loadTechnicians}
      />
    </div>
  );
}
