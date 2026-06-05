import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TicketCard } from './TicketCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

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
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => { setPage(1); }, [filters]);

  const loadTickets = useCallback(async () => {
    if (!profile) { setLoading(false); return; }

    setLoading(true);
    setError(false);
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

    if (filters.status) query = query.eq('status', filters.status as any);
    if (filters.prioridade) query = query.eq('prioridade', filters.prioridade as any);
    if (filters.categoria) query = query.eq('category_id', filters.categoria);
    if (filters.viaQRCode) query = query.eq('public_request', filters.viaQRCode === 'true');
    if (filters.canal) query = query.eq('canal', filters.canal);

    const { data, error: fetchError, count } = await query;

    if (fetchError) {
      console.error('Error loading tickets:', fetchError);
      setError(true);
    } else {
      if (data