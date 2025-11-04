import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TicketCard } from '@/components/tickets/TicketCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface CompanyTicketsProps {
  companyId: string;
}

export function CompanyTickets({ companyId }: CompanyTicketsProps) {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, [companyId]);

  const loadTickets = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          categories(nome),
          subcategories(nome),
          assets(tipo, tag_patrimonial, numero_serie),
          profiles!tickets_solicitante_id_fkey(nome)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar tickets',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum ticket encontrado para esta empresa.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tickets.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} />
      ))}
    </div>
  );
}
