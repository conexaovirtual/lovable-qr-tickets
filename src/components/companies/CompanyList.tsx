import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CompanyCard } from './CompanyCard';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CompanyListProps {
  onEdit: (company: any) => void;
  refreshTrigger?: number;
}

const ITEMS_PER_PAGE = 30;

export function CompanyList({ onEdit, refreshTrigger }: CompanyListProps) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const loadCompanies = async () => {
    setLoading(true);
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    
    const { data, error, count } = await supabase
      .from('companies_safe')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('nome_fantasia');

    if (error) {
      toast({
        title: 'Erro ao carregar empresas',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setCompanies(data || []);
      if (count !== null) setTotalCount(count);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCompanies();
  }, [refreshTrigger, page]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nenhuma empresa cadastrada</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Clique em "Nova Empresa" para começar.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map((company) => (
          <CompanyCard
            key={company.id}
            company={company}
            onEdit={onEdit}
            onUpdate={loadCompanies}
          />
        ))}
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages} ({totalCount} empresas)
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
