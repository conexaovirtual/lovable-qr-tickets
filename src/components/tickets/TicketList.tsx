import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TicketCard } from './TicketCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TicketListProps {
  filters: {
    status: string;
    prioridade: string;
    categoria: string;
    canal: string;
    viaQRCode: string;
  };
}

const ITEMS_PER_PAGE = 20;

export function TicketList({ filters }: TicketListProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    setPage(1); // Reset para página 1 ao mudar filtros
  }, [filters]);

  useEffect(() => {
    loadTickets();
  }, [profile, filters, page]);

  const loadTickets = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('tickets')
      .select(`
        id, numero, titulo, status, prioridade, created_at, canal, descricao,
        sla_atendimento_limite, sla_solucao_limite, public_request,
        solicitante_nome, solicitante_contato,
        categories(nome),
        assets(tipo, tag_patrimonial, numero_serie, nome),
        profiles!tickets_solicitante_id_fkey(nome),
        companies(nome_fantasia)
      `, { count: 'exact' })
      .range(from, to)
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
    if (filters.viaQRCode) {
      query = query.eq('public_request', filters.viaQRCode === 'true');
    }
    if (filters.canal) {
      query = query.eq('canal', filters.canal);
    }

    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error loading tickets:', error);
    }
    
    if (data) setTickets(data);
    if (count !== null) setTotalCount(count);
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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return (
    <div className="space-y-4">
      {tickets.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} />
      ))}
      
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages} ({totalCount} tickets)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p - 1)}
              disabled={!hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!hasNextPage}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
