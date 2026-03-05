import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { TechnicianList } from '@/components/technicians/TechnicianList';
import { TechnicianDialog } from '@/components/technicians/TechnicianDialog';
import { Button } from '@/components/ui/button';
import { UserPlus, Wrench, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';

export default function Technicians() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0 });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !profile) { navigate('/auth'); return; }
    if (profile && !profile.roles?.includes('admin_provedor') && !profile.roles?.includes('gestor_cliente')) {
      navigate('/dashboard'); toast.error('Acesso negado'); return;
    }
    if (profile) loadTechnicians();
  }, [profile, loading, navigate]);

  const loadTechnicians = async () => {
    try {
      setLoadingData(true);
      const { data: technicianRoles, error: rolesError } = await supabase
        .from('user_roles').select('user_id, role').eq('role', 'tecnico');
      if (rolesError) throw rolesError;
      if (!technicianRoles || technicianRoles.length === 0) {
        setTechnicians([]); setStats({ total: 0, active: 0 }); setLoadingData(false); return;
      }
      const technicianIds = technicianRoles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles').select(`*, company:companies(nome_fantasia)`)
        .in('id', technicianIds).order('nome');
      if (profilesError) throw profilesError;
      const techniciansWithRoles = profiles?.map(profile => ({
        ...profile,
        roles: technicianRoles.filter(r => r.user_id === profile.id).map(r => ({ role: r.role }))
      })) || [];
      setTechnicians(techniciansWithRoles);
      setStats({ total: techniciansWithRoles.length, active: techniciansWithRoles.length });
    } catch (error: any) {
      console.error('Error loading technicians:', error);
      toast.error('Erro ao carregar técnicos: ' + error.message);
    } finally { setLoadingData(false); }
  };

  if (loading || !profile) return null;

  return (
    <div className="bg-background min-h-screen">
      <PageHeader
        icon={Wrench}
        title="Técnicos"
        subtitle="Gerencie os técnicos do sistema"
        metrics={[
          { icon: Users, label: "Total", value: stats.total, color: "bg-blue-600/90" },
          { icon: Wrench, label: "Ativos", value: stats.active, color: "bg-emerald-600/90" },
        ]}
        actions={
          profile.roles?.includes('admin_provedor') ? (
            <Button
              onClick={() => setIsDialogOpen(true)}
              size="sm"
              className="h-8 text-xs gap-1 bg-white/10 hover:bg-white/20 text-white border-0"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo Técnico</span>
            </Button>
          ) : undefined
        }
      />

      <main className="container mx-auto px-4 py-4">
        <TechnicianList technicians={technicians} loading={loadingData} onRefresh={loadTechnicians} />
      </main>

      <TechnicianDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onSuccess={loadTechnicians} />
    </div>
  );
}
