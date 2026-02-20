import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIExecutionReportProps {
  titulo?: string;
  descricao: string;
  tempoGasto?: number;
  observacoes?: string;
  tipoServico?: string;
  onApply: (text: string) => void;
}

export function AIExecutionReport({
  titulo,
  descricao,
  tempoGasto,
  observacoes,
  tipoServico,
  onApply,
}: AIExecutionReportProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!descricao || descricao.length < 10) {
      toast({
        title: 'Descrição muito curta',
        description: 'Preencha a descrição do serviço antes de gerar o relatório.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-execution-report', {
        body: {
          titulo,
          descricao,
          tempo_gasto: tempoGasto,
          observacoes,
          tipo_servico: tipoServico,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      onApply(data.report);
      toast({ title: 'Relatório gerado pela IA' });
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar relatório',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleGenerate}
      disabled={loading}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4 text-amber-500" />
      )}
      {loading ? 'Gerando...' : 'Gerar com IA'}
    </Button>
  );
}
