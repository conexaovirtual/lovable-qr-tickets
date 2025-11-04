import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AssetCard } from '@/components/assets/AssetCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CompanyAssetsProps {
  companyId: string;
}

export function CompanyAssets({ companyId }: CompanyAssetsProps) {
  const { toast } = useToast();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAssets();
  }, [companyId]);

  const loadAssets = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          company:companies(nome_fantasia)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar ativos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter((asset) => {
    const searchLower = search.toLowerCase();
    return (
      asset.tag_patrimonial?.toLowerCase().includes(searchLower) ||
      asset.numero_serie?.toLowerCase().includes(searchLower) ||
      asset.tipo?.toLowerCase().includes(searchLower) ||
      asset.modelo?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por tag, número de série, tipo ou modelo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredAssets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? 'Nenhum ativo encontrado com esses critérios.' : 'Nenhum ativo cadastrado para esta empresa.'}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => (
            <AssetCard 
              key={asset.id} 
              asset={asset} 
              onEdit={() => {}} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
