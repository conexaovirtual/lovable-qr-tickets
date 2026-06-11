import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AISummaryCard } from '@/components/ai/AISummaryCard';
import { AISolutionSuggester } from '@/components/ai/AISolutionSuggester';

interface TicketStatusUpdateProps {
  ticket: any;
  onUpdate: () => void;
}

export function TicketStatusUpdate({ ticket, onUpdate }: TicketStatusUpdateProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState(ticket.status);
  const [solucao, setSolucao] = useState(ticket.solucao || '');
  const [loading, setLoading] = useState(false);

  const isTechnician = profile?.roles?.some(r => ['admin_provedor', 'tecnico'].includes(r)) || false;

  const handleUpdate = async () => {
    setLoading(true);
    const updates: any = { status };

    if (status === 'resolvido' && solucao.trim()) {
      updates.solucao = solucao.trim();
    }

    const { error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticket.id);

    if (error) {
      toast({
        title: 'Erro ao atualizar chamado',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Chamado atualizado',
      });
      
      if (status === 'resolvido' && solucao.trim()) {
        // Gerar artigo de conhecimento automaticamente
        supabase.functions.invoke('ai-knowledge-generator', {
          body: { ticket_id: ticket.id },
        }).catch(err => console.error('Knowledge generation error:', err));

        // Gerar e salvar resumo IA automaticamente
        supabase.functions.invoke('ai-service-summary', {
          body: { service_type: 'ticket', service_id: ticket.id },
        }).then(async ({ data }) => {
          if (!data || data.error) return;
          await supabase.from('ai_summaries').insert({
            source_type: 'ticket',
            source_id: ticket.id,
            resumo: data.resumo_executivo,
            problema_identificado: data.problema_identificado,
            solucao_aplicada: data.solucao_aplicada,
            tempo_estimado_futuro: data.tempo_estimado_futuro,
            padrao_detectado: data.padrao_detectado,
            recomendacao_preventiva: data.recomendacao_preventiva,
            tags_sugeridas: data.tags_sugeridas,
            padroes: { padrao_detectado: data.padrao_detectado },
            recomendacoes: data.recomendacao_preventiva,
          }).then(({ error }) => {
            if (!error) toast({ title: '✨ Resumo IA gerado automaticamente' });
          });
        }).catch(err => console.error('AI summary error:', err));
      }

      onUpdate();
    }
    setLoading(false);
  };

  if (!isTechnician) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Atualizar Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="novo">Novo</SelectItem>
              <SelectItem value="triagem">Triagem</SelectItem>
              <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
              <SelectItem value="aguardando_usuario">Aguardando Usuário</SelectItem>
              <SelectItem value="aguardando_peca">Aguardando Peça</SelectItem>
              <SelectItem value="resolvido">Resolvido</SelectItem>
              <SelectItem value="validando_cliente">Validando Cliente</SelectItem>
              <SelectItem value="fechado">Fechado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {status === 'resolvido' && (
          <div className="space-y-2">
            <Label htmlFor="solucao">Solução</Label>
            <AISolutionSuggester
              ticketId={ticket.id}
              onApply={(text) => setSolucao(text)}
            />
            <Textarea
              id="solucao"
              value={solucao}
              onChange={(e) => setSolucao(e.target.value)}
              placeholder="Descreva a solução aplicada..."
              rows={4}
            />
          </div>
        )}

        {/* Card de Resumo IA - aparece quando resolvido ou fechado */}
        <AISummaryCard 
          serviceType="ticket"
          serviceId={ticket.id}
          status={status}
        />

        <Button
          onClick={handleUpdate}
          disabled={loading || status === ticket.status}
          className="w-full"
        >
          {loading ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </CardContent>
    </Card>
  );
}
