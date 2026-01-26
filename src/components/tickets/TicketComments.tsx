import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Send } from 'lucide-react';
import { commentSchema } from '@/lib/validations';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';

interface TicketCommentsProps {
  ticketId: string;
}

export function TicketComments({ ticketId }: TicketCommentsProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);

  const canAddInternal = profile?.roles?.some(r => ['admin_provedor', 'tecnico'].includes(r)) || false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !comment.trim()) return;

    // Validate input
    const validation = commentSchema.safeParse({
      comentario: comment,
      is_internal: isInternal,
    });

    if (!validation.success) {
      toast({
        title: 'Erro de validação',
        description: validation.error.issues[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('ticket_comments').insert({
      ticket_id: ticketId,
      user_id: profile.id,
      comentario: validation.data.comentario,
      is_internal: validation.data.is_internal || false,
    });

    if (error) {
      toast({
        title: 'Erro ao adicionar comentário',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Comentário adicionado',
      });
      setComment('');
      setIsInternal(false);
      window.location.reload();
    }
    setLoading(false);
  };

  // Função para adicionar texto da transcrição de voz
  const handleVoiceTranscript = (transcript: string) => {
    setComment(prev => prev ? `${prev} ${transcript}` : transcript);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Adicionar Comentário</span>
          <VoiceInputButton
            onFinalResult={handleVoiceTranscript}
            size="sm"
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Digite seu comentário..."
            rows={4}
            required
          />
          {canAddInternal && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="internal"
                checked={isInternal}
                onCheckedChange={(checked) => setIsInternal(checked as boolean)}
              />
              <Label htmlFor="internal" className="text-sm cursor-pointer">
                Comentário interno (visível apenas para técnicos)
              </Label>
            </div>
          )}
          <Button type="submit" disabled={loading || !comment.trim()}>
            <Send className="h-4 w-4 mr-2" />
            {loading ? 'Enviando...' : 'Enviar Comentário'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
