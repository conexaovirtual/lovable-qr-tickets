import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  Package,
  Building2,
  FileText,
  Loader2,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Prediction {
  asset_id: string;
  asset_nome: string;
  company_id: string;
  company_nome: string;
  probabilidade_falha: number;
  tipo_falha_prevista: string;
  dias_estimados: number;
  historico_resumo: string;
  recomendacao: string;
}

interface PredictiveMaintenanceCardProps {
  companyId?: string;
}

export function PredictiveMaintenanceCard({ companyId }: PredictiveMaintenanceCardProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [creatingOS, setCreatingOS] = useState<Record<string, boolean>>({});
  const [createdOS, setCreatedOS] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState({ criticos: 0, atencao: 0 });

  useEffect(() => {
    loadPredictions();
  }, [companyId]);

  const loadPredictions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ai_predictions')
        .select(`
          *,
          assets(nome, company_id, companies(id, nome_fantasia))
        `)
        .gte('valido_ate', new Date().toISOString())
        .order('probabilidade_falha', { ascending: false })
        .limit(10);

      if (companyId) {
        query = query.eq('assets.company_id', companyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedPredictions = (data || []).map((p: any) => ({
        asset_id: p.asset_id,
        asset_nome: p.assets?.nome || 'Ativo',
        company_id: p.assets?.company_id || p.assets?.companies?.id || '',
        company_nome: p.assets?.companies?.nome_fantasia || 'Empresa',
        probabilidade_falha: p.probabilidade_falha,
        tipo_falha_prevista: p.tipo_falha_prevista,
        dias_estimados: p.dias_estimados,
        historico_resumo: p.historico_resumo,
        recomendacao: p.recomendacao
      }));

      setPredictions(formattedPredictions);
      setStats({
        criticos: formattedPredictions.filter((p: Prediction) => p.probabilidade_falha >= 70).length,
        atencao: formattedPredictions.filter((p: Prediction) => p.probabilidade_falha >= 40 && p.probabilidade_falha < 70).length
      });
    } catch (err) {
      console.error('Erro ao carregar previsões:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-predictive-maintenance', {
        body: { company_id: companyId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${data.previsoes?.length || 0} ativos analisados`);
      
      if (data.previsoes) {
        setPredictions(data.previsoes);
        setStats({
          criticos: data.ativos_criticos || 0,
          atencao: data.ativos_atencao || 0
        });
      }
    } catch (err: any) {
      toast.error('Erro ao gerar previsões');
    } finally {
      setGenerating(false);
    }
  };

  const getProbabilityColor = (prob: number) => {
    if (prob >= 70) return 'text-destructive';
    if (prob >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = (prob: number) => {
    if (prob >= 70) return 'bg-destructive';
    if (prob >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleCreateOS = async (prediction: Prediction) => {
    if (!prediction.company_id) {
      toast.error('Empresa não encontrada para este ativo');
      return;
    }

    setCreatingOS(prev => ({ ...prev, [prediction.asset_id]: true }));

    try {
      // 1. Fetch company details (address, phone)
      const { data: company } = await supabase
        .from('companies')
        .select('endereco, telefone, nome_fantasia')
        .eq('id', prediction.company_id)
        .single();

      // 2. Call smart-scheduler for next available slot
      const { data: scheduleData, error: scheduleError } = await supabase.functions.invoke('smart-scheduler', {
        body: { modalidade: 'presencial', prioridade: 'media' }
      });

      if (scheduleError) throw scheduleError;
      if (!scheduleData?.success) throw new Error(scheduleData?.error || 'Erro ao buscar horário');

      // 3. Build description with full AI context
      const descricao = [
        `[Manutenção Preventiva - IA]`,
        ``,
        `Ativo: ${prediction.asset_nome}`,
        `Empresa: ${prediction.company_nome}`,
        `Probabilidade de falha: ${prediction.probabilidade_falha}%`,
        `Tipo de falha prevista: ${prediction.tipo_falha_prevista}`,
        `Estimativa: ${prediction.dias_estimados} dias`,
        ``,
        `Recomendação: ${prediction.recomendacao || 'N/A'}`,
        ``,
        `Resumo do histórico: ${prediction.historico_resumo || 'N/A'}`,
      ].join('\n');

      // 4. Get next numero_os
      const { data: maxOS } = await supabase
        .from('service_orders')
        .select('numero_os')
        .order('numero_os', { ascending: false })
        .limit(1)
        .single();

      const nextNumero = (maxOS?.numero_os || 0) + 1;

      // 5. Insert the service order
      const { error: insertError } = await supabase
        .from('service_orders')
        .insert({
          company_id: prediction.company_id,
          asset_id: prediction.asset_id,
          tecnico_id: 'e336e78e-c11a-48b5-8d69-2bb48cf6bb3b',
          numero_os: nextNumero,
          tipo_servico: 'preventivo',
          modalidade: 'presencial',
          status: 'agendada',
          prioridade: 'media',
          descricao_servicos: descricao,
          data_agendada: `${scheduleData.data}T${scheduleData.hora_inicio}:00`,
          hora_agendada: scheduleData.hora_inicio,
          endereco_atendimento: company?.endereco || null,
          telefone_contato: company?.telefone || null,
          observacoes: `OS gerada automaticamente pela IA de Manutenção Preditiva. Probabilidade de falha: ${prediction.probabilidade_falha}%.`,
        });

      if (insertError) throw insertError;

      setCreatedOS(prev => ({ ...prev, [prediction.asset_id]: true }));
      toast.success(`OS #${nextNumero} criada! Agendada para ${scheduleData.data} às ${scheduleData.hora_inicio}`);
    } catch (err: any) {
      console.error('Erro ao criar OS:', err);
      toast.error('Erro ao criar OS preventiva: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setCreatingOS(prev => ({ ...prev, [prediction.asset_id]: false }));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Previsão de Manutenção
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardTitle>
          <Button
            onClick={handleGenerate}
            variant="outline"
            size="sm"
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats resumo */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="font-medium">{stats.criticos}</span>
            <span className="text-muted-foreground">Críticos</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="font-medium">{stats.atencao}</span>
            <span className="text-muted-foreground">Atenção</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma previsão disponível</p>
            <Button
              onClick={handleGenerate}
              variant="link"
              size="sm"
              className="mt-2"
            >
              Analisar ativos
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-h-[350px] overflow-y-auto">
            {predictions.map((pred) => (
              <div
                key={pred.asset_id}
                className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">
                        {pred.asset_nome}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Building2 className="h-3 w-3" />
                      {pred.company_nome}
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${getProbabilityColor(pred.probabilidade_falha)}`}>
                    {pred.probabilidade_falha}%
                  </div>
                </div>

                {/* Barra de probabilidade */}
                <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <div 
                    className={`absolute h-full ${getProgressColor(pred.probabilidade_falha)} transition-all`}
                    style={{ width: `${pred.probabilidade_falha}%` }}
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" />
                    {pred.tipo_falha_prevista}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Estimativa: {pred.dias_estimados} dias
                  </div>
                  {pred.recomendacao && (
                    <p className="text-primary">
                      💡 {pred.recomendacao}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={() => handleCreateOS(pred)}
                    variant={createdOS[pred.asset_id] ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    disabled={creatingOS[pred.asset_id] || createdOS[pred.asset_id]}
                  >
                    {creatingOS[pred.asset_id] ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Criando...
                      </>
                    ) : createdOS[pred.asset_id] ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        OS Criada
                      </>
                    ) : (
                      <>
                        <FileText className="h-3 w-3 mr-1" />
                        Criar OS Automática
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
