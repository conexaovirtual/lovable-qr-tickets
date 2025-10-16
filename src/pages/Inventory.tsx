import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Download, MoreVertical, Info, Edit, Trash } from 'lucide-react';
import { AssetDialog } from '@/components/assets/AssetDialog';
import { AssetConfigDialog } from '@/components/assets/AssetConfigDialog';
import { AssetStatusBadge } from '@/components/assets/AssetStatusBadge';
import { exportInventoryToCSV } from '@/lib/exportInventory';
import { toast } from 'sonner';

export default function Inventory() {
  const navigate = useNavigate();
  const { profile, loading } = useAuth();
  const [assets, setAssets] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    company_id: '',
    tipo: '',
    estado: '',
    search: ''
  });
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !profile) {
      navigate('/auth');
    }

    if (profile) {
      loadCompanies();
      loadAssets();
    }
  }, [profile, loading, navigate, filters]);

  const loadCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, nome_fantasia')
      .eq('status', true)
      .order('nome_fantasia');
    
    if (data) setCompanies(data);
  };

  const loadAssets = async () => {
    try {
      setLoadingData(true);
      let query = supabase
        .from('assets')
        .select(`
          *,
          company:companies(nome_fantasia)
        `)
        .order('created_at', { ascending: false });
      
      if (filters.company_id) query = query.eq('company_id', filters.company_id);
      if (filters.tipo) query = query.eq('tipo', filters.tipo as any);
      if (filters.estado) query = query.eq('estado', filters.estado as any);
      if (filters.search) {
        query = query.or(
          `modelo.ilike.%${filters.search}%,numero_serie.ilike.%${filters.search}%,tag_patrimonial.ilike.%${filters.search}%`
        );
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      if (data) setAssets(data);
    } catch (error: any) {
      toast.error('Erro ao carregar ativos');
      console.error(error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm('Deseja realmente excluir este ativo?')) return;

    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', assetId);

    if (error) {
      toast.error('Erro ao excluir ativo');
    } else {
      toast.success('Ativo excluído');
      loadAssets();
    }
  };

  const handleEdit = (asset: any) => {
    setEditingAsset(asset);
    setDialogOpen(true);
  };

  const handleExport = () => {
    exportInventoryToCSV(assets);
    toast.success('Inventário exportado!');
  };

  if (loading || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Inventário de Ativos</h1>
            <p className="text-muted-foreground">Visualização completa de todos os ativos</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Ativo
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select
                value={filters.company_id}
                onValueChange={(value) => setFilters({...filters, company_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas empresas" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.nome_fantasia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.tipo}
                onValueChange={(value) => setFilters({...filters, tipo: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desktop">Desktop</SelectItem>
                  <SelectItem value="notebook">Notebook</SelectItem>
                  <SelectItem value="impressora">Impressora</SelectItem>
                  <SelectItem value="servidor">Servidor</SelectItem>
                  <SelectItem value="monitor">Monitor</SelectItem>
                  <SelectItem value="roteador">Roteador</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.estado}
                onValueChange={(value) => setFilters({...filters, estado: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_uso">Em Uso</SelectItem>
                  <SelectItem value="estoque">Estoque</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                  <SelectItem value="baixado">Baixado</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Buscar modelo, serial, tag..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fabricante/Modelo</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Config</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingData ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum ativo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">
                      {asset.company?.nome_fantasia}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{asset.tipo}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{asset.fabricante}</p>
                        <p className="text-sm text-muted-foreground">{asset.modelo}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {asset.numero_serie || '-'}
                      </code>
                    </TableCell>
                    <TableCell>
                      {asset.tag_patrimonial && (
                        <Badge variant="secondary">{asset.tag_patrimonial}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <AssetStatusBadge asset={asset} />
                    </TableCell>
                    <TableCell>
                      {asset.configuracoes && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedAsset(asset)}
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(asset)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(asset.id)}
                            className="text-destructive"
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </main>

      {/* Dialogs */}
      <AssetDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingAsset(null);
        }}
        asset={editingAsset}
        onSuccess={() => {
          loadAssets();
          setDialogOpen(false);
          setEditingAsset(null);
        }}
      />

      <AssetConfigDialog
        asset={selectedAsset}
        open={!!selectedAsset}
        onOpenChange={(open) => !open && setSelectedAsset(null)}
      />
    </div>
  );
}
