import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyHealth {
  id: string;
  nome_fantasia: string;
  total_tickets: number;
  tickets_abertos: number;
  tickets_resolvidos: number;
  ultimo_atendimento: string | null;
  dias_sem_visita: number;
  tendencia: 'aumentando' | 'diminuindo' | 'estavel';
  health_score: number; // 0-100
}

export interface AnalyticsStats {
  total_tickets: number;
  tickets_abertos: number;
  tickets_resolvidos: number;
  tickets_fechados: number;
  tickets_sem_categoria: number;
  taxa_resolucao: number;
  tempo_medio_resposta_horas: number;
  sla_cumprido: number;
  sla_violado: number;
  empresas_negligenciadas: number;
}

export interface TrendData {
  mes: string;
  criados: number;
  resolvidos: number;
}

export interface CategoryDistribution {
  categoria: string;
  quantidade: number;
  percentual: number;
}

export function useAnalyticsData() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [companyHealth, setCompanyHealth] = useState<CompanyHealth[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);
  const [neglectedCompanies, setNeglectedCompanies] = useState<CompanyHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const NEGLIGENCE_DAYS_THRESHOLD = 30;

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Fetch all data in parallel
      const [
        ticketsResult,
        companiesResult,
        dailyServicesResult,
        categoriesResult
      ] = await Promise.all([
        supabase.from('tickets').select('*'),
        supabase.from('companies').select('id, nome_fantasia, status'),
        supabase.from('daily_service_records').select('company_id, data_atendimento, canal'),
        supabase.from('categories').select('id, nome')
      ]);

      if (ticketsResult.error) throw ticketsResult.error;
      if (companiesResult.error) throw companiesResult.error;
      if (dailyServicesResult.error) throw dailyServicesResult.error;

      const tickets = ticketsResult.data || [];
      const companies = companiesResult.data || [];
      const dailyServices = dailyServicesResult.data || [];
      const categories = categoriesResult.data || [];

      // Calculate main stats
      const ticketsAbertos = tickets.filter(t => !['resolvido', 'fechado'].includes(t.status || ''));
      const ticketsResolvidos = tickets.filter(t => t.status === 'resolvido');
      const ticketsFechados = tickets.filter(t => t.status === 'fechado');
      const ticketsSemCategoria = tickets.filter(t => !t.category_id);

      // Calculate SLA stats
      const ticketsComSLA = tickets.filter(t => t.sla_solucao_limite);
      const slaViolado = ticketsComSLA.filter(t => {
        if (!t.sla_solucao_limite) return false;
        const limite = new Date(t.sla_solucao_limite);
        const resolucao = t.data_solucao ? new Date(t.data_solucao) : now;
        return resolucao > limite && !['resolvido', 'fechado'].includes(t.status || '');
      });

      // Calculate average response time
      const ticketsComResposta = tickets.filter(t => t.data_primeiro_atendimento && t.created_at);
      let tempoMedioHoras = 0;
      if (ticketsComResposta.length > 0) {
        const totalHoras = ticketsComResposta.reduce((acc, t) => {
          const criado = new Date(t.created_at!);
          const respondido = new Date(t.data_primeiro_atendimento!);
          return acc + (respondido.getTime() - criado.getTime()) / (1000 * 60 * 60);
        }, 0);
        tempoMedioHoras = totalHoras / ticketsComResposta.length;
      }

      // Build company health map
      const companyMap = new Map<string, CompanyHealth>();
      
      for (const company of companies) {
        const companyTickets = tickets.filter(t => t.company_id === company.id);
        const companyServices = dailyServices.filter(s => s.company_id === company.id);
        
        // Find last service/visit date
        let ultimoAtendimento: string | null = null;
        if (companyServices.length > 0) {
          const sortedServices = [...companyServices].sort((a, b) => 
            new Date(b.data_atendimento).getTime() - new Date(a.data_atendimento).getTime()
          );
          ultimoAtendimento = sortedServices[0].data_atendimento;
        }

        // Calculate days without visit
        let diasSemVisita = 999;
        if (ultimoAtendimento) {
          diasSemVisita = Math.floor((now.getTime() - new Date(ultimoAtendimento).getTime()) / (1000 * 60 * 60 * 24));
        }

        // Calculate trend (last 3 months vs previous 3 months)
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const ticketsRecentes = companyTickets.filter(t => new Date(t.created_at!) >= threeMonthsAgo);
        const ticketsAntigos = companyTickets.filter(t => {
          const criado = new Date(t.created_at!);
          return criado >= sixMonthsAgo && criado < threeMonthsAgo;
        });

        let tendencia: 'aumentando' | 'diminuindo' | 'estavel' = 'estavel';
        if (ticketsRecentes.length > ticketsAntigos.length * 1.2) {
          tendencia = 'aumentando';
        } else if (ticketsRecentes.length < ticketsAntigos.length * 0.8) {
          tendencia = 'diminuindo';
        }

        // Calculate health score (0-100)
        // Lower is worse: many open tickets, no visits, increasing trend = bad
        let healthScore = 100;
        
        const ticketsAbertosEmpresa = companyTickets.filter(t => !['resolvido', 'fechado'].includes(t.status || ''));
        healthScore -= ticketsAbertosEmpresa.length * 10; // -10 per open ticket
        
        if (diasSemVisita > 60) healthScore -= 30;
        else if (diasSemVisita > 30) healthScore -= 15;
        else if (diasSemVisita > 14) healthScore -= 5;
        
        if (tendencia === 'aumentando') healthScore -= 15;
        else if (tendencia === 'diminuindo') healthScore += 5;
        
        healthScore = Math.max(0, Math.min(100, healthScore));

        companyMap.set(company.id, {
          id: company.id,
          nome_fantasia: company.nome_fantasia,
          total_tickets: companyTickets.length,
          tickets_abertos: ticketsAbertosEmpresa.length,
          tickets_resolvidos: companyTickets.filter(t => t.status === 'resolvido').length,
          ultimo_atendimento: ultimoAtendimento,
          dias_sem_visita: diasSemVisita,
          tendencia,
          health_score: healthScore
        });
      }

      const companyHealthArray = Array.from(companyMap.values());
      const neglected = companyHealthArray.filter(c => c.dias_sem_visita >= NEGLIGENCE_DAYS_THRESHOLD);

      // Calculate trend data (last 6 months)
      const months: TrendData[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        
        const mesLabel = monthStart.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        const criados = tickets.filter(t => {
          const criado = new Date(t.created_at!);
          return criado >= monthStart && criado <= monthEnd;
        }).length;
        
        const resolvidos = tickets.filter(t => {
          if (!t.data_solucao) return false;
          const resolucao = new Date(t.data_solucao);
          return resolucao >= monthStart && resolucao <= monthEnd;
        }).length;
        
        months.push({ mes: mesLabel, criados, resolvidos });
      }

      // Calculate category distribution
      const categoryMap = new Map<string, number>();
      categoryMap.set('Sem Categoria', 0);
      
      for (const ticket of tickets) {
        if (!ticket.category_id) {
          categoryMap.set('Sem Categoria', (categoryMap.get('Sem Categoria') || 0) + 1);
        } else {
          const category = categories.find(c => c.id === ticket.category_id);
          const nome = category?.nome || 'Desconhecida';
          categoryMap.set(nome, (categoryMap.get(nome) || 0) + 1);
        }
      }

      const totalTickets = tickets.length || 1;
      const distribution: CategoryDistribution[] = Array.from(categoryMap.entries())
        .map(([categoria, quantidade]) => ({
          categoria,
          quantidade,
          percentual: Math.round((quantidade / totalTickets) * 100)
        }))
        .sort((a, b) => b.quantidade - a.quantidade);

      // Set all states
      setStats({
        total_tickets: tickets.length,
        tickets_abertos: ticketsAbertos.length,
        tickets_resolvidos: ticketsResolvidos.length,
        tickets_fechados: ticketsFechados.length,
        tickets_sem_categoria: ticketsSemCategoria.length,
        taxa_resolucao: tickets.length > 0 
          ? Math.round(((ticketsResolvidos.length + ticketsFechados.length) / tickets.length) * 100) 
          : 0,
        tempo_medio_resposta_horas: Math.round(tempoMedioHoras * 10) / 10,
        sla_cumprido: ticketsComSLA.length - slaViolado.length,
        sla_violado: slaViolado.length,
        empresas_negligenciadas: neglected.length
      });

      setCompanyHealth(companyHealthArray.sort((a, b) => a.health_score - b.health_score));
      setNeglectedCompanies(neglected.sort((a, b) => b.dias_sem_visita - a.dias_sem_visita));
      setTrendData(months);
      setCategoryDistribution(distribution);

    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Erro ao carregar dados analíticos');
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    companyHealth,
    trendData,
    categoryDistribution,
    neglectedCompanies,
    loading,
    error,
    refresh: loadAnalyticsData
  };
}
