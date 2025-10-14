import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, CheckCircle, Wrench, Box, HardDrive, MemoryStick } from 'lucide-react';

interface InventoryReportProps {
  companyId?: string;
}

export function InventoryReport({ companyId }: InventoryReportProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, [companyId]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('asset_inventory_by_company')
        .select('*');
      
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      
      const { data: result } = await query;
      setData(result?.[0]);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum dado de inventário disponível
        </CardContent>
      </Card>
    );
  }

  const warrantyPercentage = data.total_ativos > 0 
    ? (data.ativos_em_garantia / data.total_ativos) * 100 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventário de Ativos</CardTitle>
        <CardDescription>{data.nome_fantasia}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-primary/10 rounded-lg">
            <Package className="h-8 w-8 text-primary mb-2" />
            <p className="text-2xl font-bold">{data.total_ativos || 0}</p>
            <p className="text-sm text-muted-foreground">Total de Ativos</p>
          </div>

          <div className="p-4 bg-green-500/10 rounded-lg">
            <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
            <p className="text-2xl font-bold">{data.ativos_em_uso || 0}</p>
            <p className="text-sm text-muted-foreground">Em Uso</p>
          </div>

          <div className="p-4 bg-yellow-500/10 rounded-lg">
            <Wrench className="h-8 w-8 text-yellow-600 mb-2" />
            <p className="text-2xl font-bold">{data.ativos_manutencao || 0}</p>
            <p className="text-sm text-muted-foreground">Manutenção</p>
          </div>

          <div className="p-4 bg-blue-500/10 rounded-lg">
            <Box className="h-8 w-8 text-blue-600 mb-2" />
            <p className="text-2xl font-bold">{data.ativos_estoque || 0}</p>
            <p className="text-sm text-muted-foreground">Estoque</p>
          </div>
        </div>

        {/* By Type */}
        <div>
          <h4 className="font-semibold mb-3">Ativos por Tipo</h4>
          <div className="grid grid-cols-2 gap-2">
            {data.total_desktops > 0 && (
              <div className="flex justify-between items-center py-2 px-3 rounded bg-muted/50">
                <span className="text-sm">Desktops</span>
                <Badge variant="secondary">{data.total_desktops}</Badge>
              </div>
            )}
            {data.total_notebooks > 0 && (
              <div className="flex justify-between items-center py-2 px-3 rounded bg-muted/50">
                <span className="text-sm">Notebooks</span>
                <Badge variant="secondary">{data.total_notebooks}</Badge>
              </div>
            )}
            {data.total_impressoras > 0 && (
              <div className="flex justify-between items-center py-2 px-3 rounded bg-muted/50">
                <span className="text-sm">Impressoras</span>
                <Badge variant="secondary">{data.total_impressoras}</Badge>
              </div>
            )}
            {data.total_servidores > 0 && (
              <div className="flex justify-between items-center py-2 px-3 rounded bg-muted/50">
                <span className="text-sm">Servidores</span>
                <Badge variant="secondary">{data.total_servidores}</Badge>
              </div>
            )}
            {data.total_monitores > 0 && (
              <div className="flex justify-between items-center py-2 px-3 rounded bg-muted/50">
                <span className="text-sm">Monitores</span>
                <Badge variant="secondary">{data.total_monitores}</Badge>
              </div>
            )}
            {data.total_roteadores > 0 && (
              <div className="flex justify-between items-center py-2 px-3 rounded bg-muted/50">
                <span className="text-sm">Roteadores</span>
                <Badge variant="secondary">{data.total_roteadores}</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Average Specs */}
        {(data.media_ram_gb || data.media_armazenamento_gb) && (
          <div>
            <h4 className="font-semibold mb-3">Configurações Médias</h4>
            <div className="grid grid-cols-2 gap-4">
              {data.media_ram_gb && (
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">RAM: {Number(data.media_ram_gb).toFixed(1)} GB</span>
                </div>
              )}
              {data.media_armazenamento_gb && (
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Armazenamento: {Number(data.media_armazenamento_gb).toFixed(0)} GB</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Warranty Status */}
        {data.total_ativos > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Status de Garantia</h4>
            <Progress value={warrantyPercentage} className="mb-2" />
            <div className="flex justify-between text-sm">
              <span className="text-green-600">{data.ativos_em_garantia || 0} em garantia</span>
              <span className="text-red-600">{data.ativos_fora_garantia || 0} fora da garantia</span>
            </div>
            {data.ativos_garantia_expirando > 0 && (
              <p className="text-sm text-yellow-600 mt-2">
                ⚠️ {data.ativos_garantia_expirando} ativo(s) com garantia expirando em 90 dias
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
