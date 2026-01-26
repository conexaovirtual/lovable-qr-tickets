import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { CompanyHealth } from '@/hooks/useAnalyticsData';

export interface VisitPlan {
  company_id: string;
  company_name: string;
  proxima_visita: string;
  frequencia: 'semanal' | 'quinzenal' | 'mensal' | 'trimestral';
  prioridade: 'alta' | 'media' | 'baixa';
  motivo: 'preventiva' | 'corretiva' | 'acompanhamento';
  justificativa_ia: string;
}

export interface VisitSchedule {
  id: string;
  company_id: string;
  frequencia: string;
  proxima_visita: string;
  ultima_visita: string | null;
  motivo: string;
  prioridade: string;
  status: string;
  ai_justificativa: string | null;
  tecnico_responsavel_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export function useVisitSchedule() {
  const [loading, setLoading] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<VisitPlan[] | null>(null);
  const [planSummary, setPlanSummary] = useState<string | null>(null);

  const generateVisitPlan = async (companies: CompanyHealth[]) => {
    setLoading(true);
    setGeneratedPlan(null);
    setPlanSummary(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      const companiesData = companies.map(c => ({
        id: c.id,
        nome_fantasia: c.nome_fantasia,
        dias_sem_visita: c.dias_sem_visita,
        total_chamados: c.total_tickets,
        chamados_abertos: c.tickets_abertos,
        health_score: c.health_score,
        ultimo_atendimento: c.ultimo_atendimento,
      }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-visit-planner`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ companies: companiesData }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          throw new Error('Limite de requisições excedido. Tente novamente mais tarde.');
        }
        if (response.status === 402) {
          throw new Error('Créditos insuficientes. Por favor, adicione créditos.');
        }
        throw new Error(errorData.error || 'Erro ao gerar plano de visitas');
      }

      const data = await response.json();
      
      if (data.success && data.plan) {
        setGeneratedPlan(data.plan);
        setPlanSummary(data.resumo);
        toast({
          title: 'Plano gerado com sucesso!',
          description: `${data.plan.length} visitas sugeridas pela IA`,
        });
      }

      return data;
    } catch (error) {
      console.error('Error generating visit plan:', error);
      toast({
        title: 'Erro ao gerar plano',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const mapPrioridade = (visitPriority: string): string => {
    switch (visitPriority) {
      case 'alta': return 'urgente';
      case 'media': return 'media';
      case 'baixa': return 'baixa';
      default: return 'media';
    }
  };

  const getNextOsNumber = async (): Promise<number> => {
    const { data } = await supabase
      .from('service_orders')
      .select('numero_os')
      .order('numero_os', { ascending: false })
      .limit(1);
    
    return (data?.[0]?.numero_os || 0) + 1;
  };

  const createServiceOrdersForVisits = async (visits: VisitPlan[]): Promise<{ visitCompanyId: string; osId: string }[]> => {
    const serviceOrders: { visitCompanyId: string; osId: string }[] = [];
    
    for (const visit of visits) {
      // Buscar endereco da empresa
      const { data: company } = await supabase
        .from('companies')
        .select('endereco, telefone')
        .eq('id', visit.company_id)
        .single();

      const nextNumber = await getNextOsNumber();

      // Criar OS
      const { data: os, error } = await supabase
        .from('service_orders')
        .insert({
          company_id: visit.company_id,
          tipo_servico: 'preventivo',
          prioridade: mapPrioridade(visit.prioridade),
          descricao_servicos: `Visita preventiva - ${visit.company_name}`,
          data_agendada: `${visit.proxima_visita}T09:00:00`,
          hora_agendada: '09:00',
          status: 'agendada',
          numero_os: nextNumber,
          endereco_atendimento: company?.endereco || null,
          telefone_contato: company?.telefone || null,
          observacoes: `Visita gerada pelo Planejador de Visitas IA.\n\nJustificativa: ${visit.justificativa_ia}`,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating service order:', error);
        continue;
      }

      if (os) {
        serviceOrders.push({ visitCompanyId: visit.company_id, osId: os.id });
      }
    }
    
    return serviceOrders;
  };

  const saveVisitPlan = async (visits: VisitPlan[], options?: { createServiceOrders?: boolean }): Promise<{ success: boolean; osCount?: number }> => {
    setLoading(true);
    const createServiceOrders = options?.createServiceOrders ?? false;

    try {
      let createdOrders: { visitCompanyId: string; osId: string }[] = [];

      // Criar OSs se solicitado
      if (createServiceOrders) {
        createdOrders = await createServiceOrdersForVisits(visits);
      }

      // Criar mapa de company_id -> service_order_id
      const osMap = new Map(createdOrders.map(o => [o.visitCompanyId, o.osId]));

      // Inserir visit_schedules com referência às OSs criadas
      const { error } = await supabase.from('visit_schedules' as any).insert(
        visits.map(v => ({
          company_id: v.company_id,
          frequencia: v.frequencia,
          proxima_visita: v.proxima_visita,
          motivo: v.motivo,
          prioridade: v.prioridade,
          status: 'pendente',
          ai_justificativa: v.justificativa_ia,
          service_order_id: osMap.get(v.company_id) || null,
        }))
      );

      if (error) throw error;

      const osCountMsg = createServiceOrders && createdOrders.length > 0 
        ? ` e ${createdOrders.length} ordens de serviço criadas`
        : '';

      toast({
        title: 'Plano salvo com sucesso!',
        description: `${visits.length} visitas agendadas${osCountMsg}`,
      });

      setGeneratedPlan(null);
      setPlanSummary(null);

      return { success: true, osCount: createdOrders.length };
    } catch (error) {
      console.error('Error saving visit plan:', error);
      toast({
        title: 'Erro ao salvar plano',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledVisits = async (): Promise<(VisitSchedule & { company_name?: string })[]> => {
    try {
      // Fetch visits and companies separately to avoid type issues
      const { data: visits, error: visitsError } = await supabase
        .from('visit_schedules' as any)
        .select('*')
        .order('proxima_visita', { ascending: true });

      if (visitsError) throw visitsError;
      if (!visits) return [];

      // Cast to unknown first then to our type to avoid TS errors
      const visitsArray = visits as unknown as VisitSchedule[];

      // Fetch company names for all visits
      const companyIds = [...new Set(visitsArray.map(v => v.company_id))];
      const { data: companies } = await supabase
        .from('companies')
        .select('id, nome_fantasia')
        .in('id', companyIds);

      const companyMap = new Map(companies?.map(c => [c.id, c.nome_fantasia]) || []);

      return visitsArray.map(v => ({
        ...v,
        company_name: companyMap.get(v.company_id) || 'Empresa desconhecida',
      }));
    } catch (error) {
      console.error('Error fetching scheduled visits:', error);
      return [];
    }
  };

  const updateVisitStatus = async (
    visitId: string,
    status: 'pendente' | 'agendada' | 'concluida' | 'cancelada' | 'atrasada'
  ) => {
    try {
      const { error } = await supabase
        .from('visit_schedules' as any)
        .update({ status })
        .eq('id', visitId);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: `Visita marcada como ${status}`,
      });

      return true;
    } catch (error) {
      console.error('Error updating visit status:', error);
      toast({
        title: 'Erro ao atualizar status',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    loading,
    generatedPlan,
    planSummary,
    generateVisitPlan,
    saveVisitPlan,
    fetchScheduledVisits,
    updateVisitStatus,
    clearPlan: () => {
      setGeneratedPlan(null);
      setPlanSummary(null);
    },
  };
}
