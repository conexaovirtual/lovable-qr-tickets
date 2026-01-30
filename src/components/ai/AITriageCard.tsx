import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, Sparkles, User, FileText, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TriageResult {
  prioridade_sugerida: string;
  urgencia_sugerida: string;
  tecnico_sugerido?: { id: string; nome: string; motivo: string };
  tickets_similares?: Array<{ titulo: string; solucao_resumo: string; similaridade: number }>;
  justificativa: string;
}

interface AITriageCardProps {
  ticket: any;
  onApplySuggestion?: (data: { prioridade?: string; urgencia?: string; tecnico_id?: string }) => void;
}

export function AITriageCard({ ticket, onApplySuggestion }: AITriageCardProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-ticket-triage', {
        body: { ticket_id: ticket.id }
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      
      setResult(data);
    } catch (err: any) {
      console.error('Erro na triagem IA:', err);
      setError(err.message || 'Erro ao analisar com IA');
      toast.error('Erro ao analisar com IA');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!result) return;

    const updates: any = {};
    
    if (result.prioridade_sugerida) {
      updates.prioridade = result.prioridade_sugerida;
    }
    if (result.urgencia_sugerida) {
      updates.urgencia = result.urgencia_sugerida;
    }
    if (result.tecnico_sugerido?.id) {
      updates.tecnico_id = result.tecnico_sugerido.id;
    }

    try {
      const { error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', ticket.id);

      if (error) throw error;
      
      toast.success('Sugestões aplicadas com sucesso!');
      onApplySuggestion?.(updates);
    } catch (err: any) {
      toast.error('Erro ao aplicar sugestões');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critica': return 'destructive';
      case 'alta': return 'warning';
      case 'media': return 'secondary';
      default: return 'outline';
    }
  };

  // Só mostrar para tickets novos ou em triagem
  if (!['novo', 'triagem'].includes(ticket.status)) {
    return null;
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Triagem IA
          <Sparkles className="h-4 w-4 text-yellow-500" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!result && !loading && (
          <>
            <p className="text-sm text-muted-foreground">
              A IA pode analisar este chamado e sugerir prioridade, técnico ideal e tickets similares.
            </p>
            <Button 
              onClick={handleAnalyze} 
              className="w-full"
              variant="outline"
            >
              <Brain className="h-4 w-4 mr-2" />
              Analisar com IA
            </Button>
          </>
        )}

        {loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando chamado...
            </div>
            <Skeleton className="h-20 w-full" />
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
            {/* Sugestões */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Prioridade Sugerida</p>
                <Badge variant={getPriorityColor(result.prioridade_sugerida) as any}>
                  {result.prioridade_sugerida}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Urgência Sugerida</p>
                <Badge variant="secondary">{result.urgencia_sugerida}</Badge>
              </div>
            </div>

            {/* Técnico sugerido */}
            {result.tecnico_sugerido && (
              <div className="p-2 bg-muted/50 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium">{result.tecnico_sugerido.nome}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {result.tecnico_sugerido.motivo}
                </p>
              </div>
            )}

            {/* Tickets similares */}
            {result.tickets_similares && result.tickets_similares.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Tickets Similares Resolvidos
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {result.tickets_similares.slice(0, 3).map((similar, idx) => (
                    <div key={idx} className="p-2 bg-muted/30 rounded text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate flex-1">{similar.titulo}</span>
                        <Badge variant="outline" className="text-xs ml-2">
                          {similar.similaridade}%
                        </Badge>
                      </div>
                      {similar.solucao_resumo && (
                        <p className="text-muted-foreground line-clamp-2">
                          💡 {similar.solucao_resumo}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Justificativa */}
            <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 {result.justificativa}
              </p>
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2">
              <Button onClick={handleApply} className="flex-1" size="sm">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Aplicar Sugestões
              </Button>
              <Button 
                onClick={handleAnalyze} 
                variant="outline" 
                size="sm"
              >
                Reanalisar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
