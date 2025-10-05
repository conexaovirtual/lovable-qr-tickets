import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AssetCard } from './AssetCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface AssetListProps {
  onEdit: (asset: any) => void;
}

export function AssetList({ onEdit }: AssetListProps) {
  const { profile } = useAuth();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAssets();
  }, [profile]);

  const loadAssets = async () => {
    if (!profile) return;

    setLoading(true);
    const { data } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setAssets(data);
    setLoading(false);
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por tag, série, tipo ou modelo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredAssets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {search ? 'Nenhum ativo encontrado' : 'Nenhum ativo cadastrado'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
