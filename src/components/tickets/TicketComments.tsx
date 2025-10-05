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

interface TicketCommentsProps {
  ticketId: string;
}

export function TicketComments({ ticketId }: TicketCommentsProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);

  const canAddInternal = profile?.role && ['admin_provedor', 'tecnico'].includes(profile.role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !comment.trim()) return;

    setLoading(true);
    const { error } = await supabase.from('ticket_comments').insert({
      ticket_id: ticketId,
      user_id: profile.id,
      comentario: comment.trim(),
      is_internal: isInternal,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adicionar Comentário</CardTitle>
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
