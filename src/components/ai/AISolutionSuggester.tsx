import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2, Check, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AISolutionSuggesterProps {
  ticketId?: string;
  dailyRecordId?: string;
  onApply: (text: string) => void;
}

export function AISolutionSuggester({ ticketId, dailyRecordId, onApply }: AISolutionSuggesterProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const { toast } = useToast();

  const handleSuggest = async () => {
    setLoading(true);
    setSuggestion(null);
    setApplied(false);

    try {
      const { data, error } = await supabase.functions.invoke('ai-solution-suggester', {
        body: { ticket_id: ticketId, daily_record_id: dailyRecordId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSuggestion(data.suggestion);
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar sugestão',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (suggestion) {
      onApply(suggestion);
      setApplied(true);
      toast({ title: 'Sugestão aplicada ao campo de solução' });
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSuggest}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 text-amber-500" />
        )}
        {loading ? 'Gerando sugestão...' : 'Sugerir Solução com IA'}
      </Button>

      {suggestion && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="p-3 space-y-2">
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Sugestão da IA
            </p>
            <p className="text-sm whitespace-pre-wrap">{suggestion}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={applied ? 'secondary' : 'default'}
                onClick={handleApply}
                disabled={applied}
                className="gap-1"
              >
                {applied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {applied ? 'Aplicado' : 'Usar esta sugestão'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
