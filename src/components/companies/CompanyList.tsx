import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CompanyCard } from './CompanyCard';
import { useToast } from '@/hooks/use-toast';

interface CompanyListProps {
  onEdit: (company: any) => void;
  refreshTrigger?: number;
}

export function CompanyList({ onEdit, refreshTrigger }: CompanyListProps) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('companies_safe')
      .select('*')
      .order('nome_fantasia');

    if (error) {
      toast({
        title: 'Erro ao carregar empresas',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setCompanies(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCompanies();
  }, [refreshTrigger]);

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

  return (
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
  );
}
