import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Cpu, MemoryStick, HardDrive, Monitor } from 'lucide-react';


interface AssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: any;
  preSelectedCompanyId?: string;
  onSuccess?: (assetId?: string) => void;
}

export function AssetDialog({ open, onOpenChange, asset, preSelectedCompanyId, onSuccess }: AssetDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    company_id: '',
    nome: '',
    tipo: '',
    categoria_id: '',
    subcategoria_id: '',
    fabricante: '',
    modelo: '',
    numero_serie: '',
    tag_patrimonial: '',
    local: '',
    setor: '',
    sistema_operacional: '',
    estado: 'em_uso' as const,
    data_compra: '',
    garantia_fim: '',
    observacoes: '',
  });

  const [configs, setConfigs] = useState<any>({
    processador: '',
    processador_cores: undefined,
    processador_ghz: undefined,
    memoria_ram_gb: undefined,
    memoria_ram_tipo: '',
    memoria_ram_slots: undefined,
    armazenamento_principal_gb: undefined,
    armazenamento_principal_tipo: '',
    armazenamento_secundario_gb: undefined,
    armazenamento_secundario_tipo: '',
    placa_video: '',
    placa_video_memoria_gb: undefined,
    placa_video_integrada: false,
    tela_polegadas: undefined,
    tela_resolucao: '',
    rede_ethernet: false,
    rede_wifi: false,
    rede_wifi_standard: '',
  });

  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, nome_fantasia')
        .eq('status', true)
        .order('nome_fantasia');
      
      if (data) setCompanies(data);
    };

    const fetchCategories = async () => {
      const { data } = await supabase
        .from('asset_categories')
        .select('id, nome, descricao, cor')
        .order('nome');
      
      if (data) setCategories(data);
    };

    if (open) {
      fetchCompanies();
      fetchCategories();
    }

    if (asset) {
      setFormData({
        company_id: asset.company_id || '',
        nome: asset.nome || '',
        tipo: asset.tipo || '',
        categoria_id: asset.categoria_id || '',
        subcategoria_id: asset.subcategoria_id || '',
        fabricante: asset.fabricante || '',
        modelo: asset.modelo || '',
        numero_serie: asset.numero_serie || '',
        tag_patrimonial: asset.tag_patrimonial || '',
        local: asset.local || '',
        setor: asset.setor || '',
        sistema_operacional: asset.sistema_operacional || '',
        estado: asset.estado || 'em_uso',
        data_compra: asset.data_compra || '',
        garantia_fim: asset.garantia_fim || '',
        observacoes: asset.observacoes || '',
      });
      setConfigs(asset.configuracoes || {});
    } else {
      setFormData({
        company_id: preSelectedCompanyId || profile?.company_id || '',
        nome: '',
        tipo: '',
        categoria_id: '',
        subcategoria_id: '',
        fabricante: '',
        modelo: '',
        numero_serie: '',
        tag_patrimonial: '',
        local: '',
        setor: '',
        sistema_operacional: '',
        estado: 'em_uso',
        data_compra: '',
        garantia_fim: '',
        observacoes: '',
      });
      setConfigs({});
    }
  }, [asset, open, profile, preSelectedCompanyId]);

  useEffect(() => {
    const fetchSubcategories = async () => {
      if (!formData.categoria_id) {
        setSubcategories([]);
        return;
      }

      const { data } = await supabase
        .from('asset_subcategories')
        .select('id, nome')
        .eq('category_id', formData.categoria_id)
        .order('nome');
      
      if (data) setSubcategories(data);
    };

    fetchSubcategories();
  }, [formData.categoria_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company_id) {
      toast({
        title: 'Erro',
        description: 'Selecione uma empresa',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.nome || formData.nome.trim() === '') {
      toast({
        title: 'Erro',
        description: 'O nome do ativo é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const payload: any = {
      ...formData,
      configuracoes: configs,
    };

    let newAssetId: string | undefined;

    if (asset) {
      const { error } = await supabase.from('assets').update(payload).eq('id', asset.id);
      
      if (error) {
        toast({
          title: 'Erro ao atualizar ativo',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Ativo atualizado',
        });
        onOpenChange(false);
        onSuccess?.();
      }
    } else {
      const { data, error } = await supabase
        .from('assets')
        .insert(payload)
        .select()
        .single();

      if (error) {
        toast({
          title: 'Erro ao cadastrar ativo',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        newAssetId = data.id;
        toast({
          title: 'Ativo cadastrado',
        });
        onOpenChange(false);
        onSuccess?.(newAssetId);
      }
    }
    
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? 'Editar Ativo' : 'Novo Ativo'}</DialogTitle>
          <DialogDescription>
            Preencha as informações do equipamento/patrimônio
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
              <TabsTrigger value="hardware">Hardware</TabsTrigger>
              <TabsTrigger value="additional">Adicionais</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="company_id">Empresa *</Label>
                  <Select
                    required
                    value={formData.company_id}
                    onValueChange={(value) => setFormData({ ...formData, company_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.nome_fantasia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nome">Nome do Ativo *</Label>
                  <Input
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Notebook João - TI, Desktop Recepção, Impressora 2º Andar"
                  />
                  <p className="text-xs text-muted-foreground">
                    Identificação única e descritiva do ativo (será exibida ao selecionar o ativo)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select
                    required
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="notebook">Notebook</SelectItem>
                      <SelectItem value="impressora">Impressora</SelectItem>
                      <SelectItem value="monitor">Monitor</SelectItem>
                      <SelectItem value="roteador">Roteador</SelectItem>
                      <SelectItem value="switch">Switch</SelectItem>
                      <SelectItem value="servidor">Servidor</SelectItem>
                      <SelectItem value="periferico">Periférico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select
                    value={formData.categoria_id}
                    onValueChange={(value) => setFormData({ ...formData, categoria_id: value, subcategoria_id: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subcategoria">Subcategoria</Label>
                  <Select
                    value={formData.subcategoria_id}
                    onValueChange={(value) => setFormData({ ...formData, subcategoria_id: value })}
                    disabled={!formData.categoria_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.categoria_id ? "Selecione uma subcategoria" : "Selecione uma categoria primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado">Estado *</Label>
                  <Select
                    required
                    value={formData.estado}
                    onValueChange={(value: any) => setFormData({ ...formData, estado: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em_uso">Em Uso</SelectItem>
                      <SelectItem value="estoque">Estoque</SelectItem>
                      <SelectItem value="manutencao">Manutenção</SelectItem>
                      <SelectItem value="baixado">Baixado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Fabricante</Label>
                  <Input
                    value={formData.fabricante}
                    onChange={(e) => setFormData({ ...formData, fabricante: e.target.value })}
                    placeholder="Ex: Dell, HP, Lenovo"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Input
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Número de Série</Label>
                  <Input
                    value={formData.numero_serie}
                    onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tag Patrimonial</Label>
                  <Input
                    value={formData.tag_patrimonial}
                    onChange={(e) => setFormData({ ...formData, tag_patrimonial: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Local</Label>
                  <Input
                    value={formData.local}
                    onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                    placeholder="Ex: Sala 101"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Input
                    value={formData.setor}
                    onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                    placeholder="Ex: TI, Financeiro"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="hardware" className="space-y-4">
              {/* Processador */}
              <div className="p-4 border rounded-lg space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Processador
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label>Modelo</Label>
                    <Input
                      value={configs.processador}
                      onChange={(e) => setConfigs({...configs, processador: e.target.value})}
                      placeholder="Ex: Intel Core i7-12700K"
                    />
                  </div>
                  <div>
                    <Label>Cores</Label>
                    <Input
                      type="number"
                      value={configs.processador_cores || ''}
                      onChange={(e) => setConfigs({...configs, processador_cores: e.target.value ? parseInt(e.target.value) : undefined})}
                    />
                  </div>
                </div>
              </div>

              {/* Memória RAM */}
              <div className="p-4 border rounded-lg space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <MemoryStick className="h-4 w-4" />
                  Memória RAM
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Capacidade (GB)</Label>
                    <Input
                      type="number"
                      value={configs.memoria_ram_gb || ''}
                      onChange={(e) => setConfigs({...configs, memoria_ram_gb: e.target.value ? parseInt(e.target.value) : undefined})}
                    />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={configs.memoria_ram_tipo}
                      onValueChange={(value) => setConfigs({...configs, memoria_ram_tipo: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DDR3">DDR3</SelectItem>
                        <SelectItem value="DDR4">DDR4</SelectItem>
                        <SelectItem value="DDR5">DDR5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Slots</Label>
                    <Input
                      type="number"
                      value={configs.memoria_ram_slots || ''}
                      onChange={(e) => setConfigs({...configs, memoria_ram_slots: e.target.value ? parseInt(e.target.value) : undefined})}
                    />
                  </div>
                </div>
              </div>

              {/* Armazenamento */}
              <div className="p-4 border rounded-lg space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Armazenamento
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Capacidade (GB)</Label>
                    <Input
                      type="number"
                      value={configs.armazenamento_principal_gb || ''}
                      onChange={(e) => setConfigs({...configs, armazenamento_principal_gb: e.target.value ? parseInt(e.target.value) : undefined})}
                    />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={configs.armazenamento_principal_tipo}
                      onValueChange={(value) => setConfigs({...configs, armazenamento_principal_tipo: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HDD">HDD</SelectItem>
                        <SelectItem value="SSD">SSD</SelectItem>
                        <SelectItem value="NVMe">NVMe</SelectItem>
                        <SelectItem value="M.2">M.2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Placa de Vídeo */}
              <div className="p-4 border rounded-lg space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Placa de Vídeo
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Modelo</Label>
                    <Input
                      value={configs.placa_video}
                      onChange={(e) => setConfigs({...configs, placa_video: e.target.value})}
                      placeholder="Ex: NVIDIA RTX 4070"
                    />
                  </div>
                  <div>
                    <Label>VRAM (GB)</Label>
                    <Input
                      type="number"
                      value={configs.placa_video_memoria_gb || ''}
                      onChange={(e) => setConfigs({...configs, placa_video_memoria_gb: e.target.value ? parseInt(e.target.value) : undefined})}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={configs.placa_video_integrada}
                    onCheckedChange={(checked) => setConfigs({...configs, placa_video_integrada: checked as boolean})}
                  />
                  <Label>Placa integrada</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="additional" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sistema Operacional</Label>
                  <Input
                    value={formData.sistema_operacional}
                    onChange={(e) => setFormData({ ...formData, sistema_operacional: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data de Compra</Label>
                  <Input
                    type="date"
                    value={formData.data_compra}
                    onChange={(e) => setFormData({ ...formData, data_compra: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Garantia até</Label>
                  <Input
                    type="date"
                    value={formData.garantia_fim}
                    onChange={(e) => setFormData({ ...formData, garantia_fim: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
