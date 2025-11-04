import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TechnicianCard } from '@/components/technicians/TechnicianCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface CompanyTechniciansProps {
  companyId: string;
}

export function CompanyTechnicians({ companyId }: CompanyTechniciansProps) {
  const { toast } = useToast();
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTechnicians();
  }, [companyId]);

  const loadTechnicians = async () => {
    setLoading(true);
    
    try {
      // Buscar técnicos que atenderam essa empresa (através dos tickets)
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('tecnico_id')
        .eq('company_id', companyId)
        .not('tecnico_id', 'is', null);

      if (ticketsError) throw ticketsError;

      // Extrair IDs únicos de técnicos
      const technicianIds = [...new Set(ticketsData?.map(t => t.tecnico_id).filter(Boolean) || [])];

      if (technicianIds.length === 0) {
        setTechnicians([]);
        setLoading(false);
        return;
      }

      // Buscar informações dos técnicos
      const { data: techniciansData, error: techniciansError } = await supabase
        .from('profiles')
        .select(`
          *,
          companies(nome_fantasia)
        `)
        .in('id', technicianIds);

      if (techniciansError) throw techniciansError;

      // Buscar roles dos técnicos
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', technicianIds)
        .eq('role', 'tecnico');

      if (rolesError) throw rolesError;

      // Criar um Set com IDs de técnicos válidos
      const validTechnicianIds = new Set(rolesData?.map(r => r.user_id) || []);

      // Filtrar apenas os perfis que são técnicos
      const filteredTechnicians = techniciansData?.filter(profile => 
        validTechnicianIds.has(profile.id)
      ) || [];

      setTechnicians(filteredTechnicians);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar técnicos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (technicians.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum técnico atendeu esta empresa ainda.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {technicians.map((technician) => (
        <TechnicianCard 
          key={technician.id} 
          technician={technician}
          onUpdate={loadTechnicians}
        />
      ))}
    </div>
  );
}
