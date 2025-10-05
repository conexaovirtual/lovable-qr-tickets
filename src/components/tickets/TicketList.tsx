import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TicketCard } from './TicketCard';
import { Skeleton } from '@/components/ui/skeleton';

interface TicketListProps {
  filters: {
    status: string;
    prioridade: string;
    categoria: string;
  };
}

export function TicketList({ filters }: TicketListProps) {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, [profile, filters]);

  const loadTickets = async () => {
    if (!profile) return;

    setLoading(true);
    let query = supabase
      .from('tickets')
      .select(`
        *,
        categories(nome),
        subcategories(nome),
        assets(tipo, tag_patrimonial, numero_serie),
        profiles!tickets_solicitante_id_fkey(nome)
      `)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status as any);
    }
    if (filters.prioridade) {
      query = query.eq('prioridade', filters.prioridade as any);
    }
    if (filters.categoria) {
      query = query.eq('category_id', filters.categoria);
    }

    const { data } = await query;
    if (data) setTickets(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhum chamado encontrado</p>
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
