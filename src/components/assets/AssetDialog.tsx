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
import { useToast } from '@/hooks/use-toast';

interface AssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: any;
  onSuccess?: () => void;
}

export function AssetDialog({ open, onOpenChange, asset, onSuccess }: AssetDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    tipo: '',
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
    company_id: '',
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

    if (open) {
      fetchCompanies();
    }

    if (asset) {
      setFormData({
        tipo: asset.tipo || '',
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
        company_id: asset.company_id || '',
      });
    } else {
      setFormData({
        tipo: '',
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
        company_id: profile?.company_id || '',
      });
    }
  }, [asset, open, profile]);

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

    setLoading(true);
    const payload: any = {
      ...formData,
    };

    const { error } = asset
      ? await supabase.from('assets').update(payload).eq('id', asset.id)
      : await supabase.from('assets').insert(payload);

    if (error) {
      toast({
        title: 'Erro ao salvar ativo',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: asset ? 'Ativo atualizado' : 'Ativo cadastrado',
      });
      onOpenChange(false);
      onSuccess?.();
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

            <div className="space-y-2">
              <Label htmlFor="fabricante">Fabricante</Label>
              <Input
                id="fabricante"
                value={formData.fabricante}
                onChange={(e) => setFormData({ ...formData, fabricante: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelo">Modelo</Label>
              <Input
                id="modelo"
                value={formData.modelo}
                onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_serie">Número de Série</Label>
              <Input
                id="numero_serie"
                value={formData.numero_serie}
                onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tag_patrimonial">Tag Patrimonial</Label>
              <Input
                id="tag_patrimonial"
                value={formData.tag_patrimonial}
                onChange={(e) => setFormData({ ...formData, tag_patrimonial: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="local">Local</Label>
              <Input
                id="local"
                value={formData.local}
                onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                placeholder="Ex: Sala 101"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="setor">Setor</Label>
              <Input
                id="setor"
                value={formData.setor}
                onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                placeholder="Ex: TI, Financeiro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sistema_operacional">Sistema Operacional</Label>
              <Input
                id="sistema_operacional"
                value={formData.sistema_operacional}
                onChange={(e) => setFormData({ ...formData, sistema_operacional: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_compra">Data de Compra</Label>
              <Input
                id="data_compra"
                type="date"
                value={formData.data_compra}
                onChange={(e) => setFormData({ ...formData, data_compra: e.target.value })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="garantia_fim">Garantia até</Label>
              <Input
                id="garantia_fim"
                type="date"
                value={formData.garantia_fim}
                onChange={(e) => setFormData({ ...formData, garantia_fim: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
            />
          </div>

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
