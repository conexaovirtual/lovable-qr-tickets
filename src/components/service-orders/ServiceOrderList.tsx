import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ServiceOrderCard } from './ServiceOrderCard';
import { ServiceOrderDetailDialog } from './ServiceOrderDetailDialog';
import { ServiceOrderCreateDialog } from './ServiceOrderCreateDialog';
import { Search, Plus } from 'lucide-react';

interface ServiceOrderListProps {
  statusFilter?: string | null;
}

export function ServiceOrderList({ statusFilter }: ServiceOrderListProps) {
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedServiceOrder, setSelectedServiceOrder] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleViewDetails = (serviceOrder: any) => {
    setSelectedServiceOrder(serviceOrder);
    setDetailDialogOpen(true);
  };

  const loadServiceOrders = async () => {
    setLoading(true);

    try {
      let query = supabase
        .from('service_orders')
        .select(`
          *,
          tickets (numero, titulo),
          companies:companies_safe (nome_fantasia, cnpj, endereco),
          profiles:tecnico_id (nome)
        `)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('data_emissao', new Date(startDate).toISOString());
      }

      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query = query.lte('data_emissao', endDateTime.toISOString());
      }

      // Apply status filter if provided
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setServiceOrders(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar OS:', error);
      toast({
        title: 'Erro ao Carregar OS',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServiceOrders();
  }, [startDate, endDate, statusFilter]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filtros
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova OS
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Data Início</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Data Fim</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {serviceOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhuma ordem de serviço encontrada no período selecionado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {serviceOrders.map((so) => (
            <ServiceOrderCard 
              key={so.id} 
              serviceOrder={so}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      <ServiceOrderDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        serviceOrder={selectedServiceOrder}
        onUpdate={loadServiceOrders}
      />

      <ServiceOrderCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={loadServiceOrders}
      />
    </div>
  );
}
