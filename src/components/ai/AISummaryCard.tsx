import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Sparkles, Save, RefreshCw, AlertTriangle, Loader2, CheckCircle2, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SummaryResult {
  resumo_executivo: string;
  problema_identificado: string;
  solucao_aplicada: string;
  tempo_estimado_futuro: string;
  padrao_detectado: boolean;
  recomendacao_preventiva: string | null;
  tags_sugeridas: string[];
}

interface AISummaryCardProps {
  serviceType: 'ticket' | 'daily_service';
  serviceId: string;
  status: string;
  onSave?: (summary: string) => void;
}

export function AISummaryCard({ serviceType, serviceId, status, onSave }: AISummaryCardProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [editedSummary, setEditedSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Mostrar apenas quando status for concluído/resolvido
  const shouldShow = serviceType === 'ticket' 
    ? ['resolvido', 'fechado'].includes(status)
    : status === 'concluido';

  if (!shouldShow) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-service-summary', {
        body: { service_type: serviceType, service_id: serviceId }
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      
      setResult(data);
      setEditedSummary(data.resumo_executivo);
    } catch (err: any) {
      console.error('Erro ao gerar resumo:', err);
      setError(err.message || 'Erro ao gerar resumo com IA');
      toast.error('Erro ao gerar resumo');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;

    try {
      // Salvar na tabela ai_summaries
      const { error } = await supabase.from('ai_summaries').insert({
        source_type: serviceType,
        source_id: serviceId,
        resumo: editedSummary,
        problema_identificado: result.problema_identificado,
        solucao_aplicada: result.solucao_aplicada,
        tempo_estimado_futuro: result.tempo_estimado_futuro,
        padrao_detectado: result.padrao_detectado,
        recomendacao_preventiva: result.recomendacao_preventiva,
        tags_sugeridas: result.tags_sugeridas,
        padroes: { padrao_detectado: result.padrao_detectado },
        recomendacoes: result.recomendacao_preventiva
      });

      if (error) throw error;

      setSaved(true);
      toast.success('Resumo salvo com sucesso!');
      onSave?.(editedSummary);
    } catch (err: any) {
      toast.error('Erro ao salvar resumo');
    }
  };

  return (
    <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-transparent dark:from-green-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-5 w-5 text-green-600" />
          Resumo IA
          <Sparkles className="h-4 w-4 text-yellow-500" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!result && !loading && (
          <>
            <p className="text-sm text-muted-foreground">
              Gere automaticamente um resumo executivo deste atendimento com análise de padrões.
            </p>
            <Button 
              onClick={handleGenerate} 
              className="w-full"
              variant="outline"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar Resumo IA
            </Button>
          </>
        )}

        {loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando atendimento...
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Resumo editável */}
            <div className="space-y-2">
              <label className="text-xs font-medium">Resumo Executivo</label>
              <Textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                rows={4}
                className="text-sm"
              />
            </div>

            {/* Problema e Solução */}
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="p-2 bg-muted/50 rounded">
                <p className="font-medium text-destructive/80">Problema:</p>
                <p className="text-muted-foreground">{result.problema_identificado}</p>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <p className="font-medium text-green-600">Solução:</p>
                <p className="text-muted-foreground">{result.solucao_aplicada}</p>
              </div>
            </div>

            {/* Padrão detectado */}
            {result.padrao_detectado && (
              <div className="p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Padrão Recorrente Detectado</span>
                </div>
                {result.recomendacao_preventiva && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    💡 {result.recomendacao_preventiva}
                  </p>
                )}
              </div>
            )}

            {/* Tags sugeridas */}
            {result.tags_sugeridas && result.tags_sugeridas.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <Tag className="h-3 w-3 text-muted-foreground" />
                {result.tags_sugeridas.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Tempo estimado */}
            <p className="text-xs text-muted-foreground">
              ⏱️ Tempo estimado para casos similares: {result.tempo_estimado_futuro}
            </p>

            {/* Botões */}
            <div className="flex gap-2">
              <Button 
                onClick={handleSave} 
                className="flex-1" 
                size="sm"
                disabled={saved}
              >
                {saved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Salvo
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Salvar Resumo
                  </>
                )}
              </Button>
              <Button 
                onClick={handleGenerate} 
                variant="outline" 
                size="sm"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
