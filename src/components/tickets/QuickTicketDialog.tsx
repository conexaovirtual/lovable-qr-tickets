import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface QuickTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function QuickTicketDialog({ open, onOpenChange, onSuccess }: QuickTicketDialogProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    company_id: '',
    asset_id: '',
    canal: 'whatsapp' as 'whatsapp' | 'ligacao' | 'visita_tecnica' | 'email' | 'web',
    titulo: '',
    descricao: '',
  });

  useEffect(() => {
    if (open) {
      loadCompanies();
      if (profile?.company_id) {
        setFormData(prev => ({ ...prev, company_id: profile.company_id }));
        loadAssets(profile.company_id);
      }
    }
  }, [open, profile]);

  const loadCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, nome_fantasia')
      .eq('status', true)
      .order('nome_fantasia');
    
    if (data) setCompanies(data);
  };

  const loadAssets = async (companyId: string) => {
    const { data } = await supabase
      .from('assets')
      .select('id, nome, tipo, tag_patrimonial')
      .eq('company_id', companyId)
      .order('nome');
    
    if (data) setAssets(data);
  };

  const handleCompanyChange = (companyId: string) => {
    setFormData(prev => ({ ...prev, company_id: companyId, asset_id: '' }));
    loadAssets(companyId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: ticketData, error } = await supabase
        .from('tickets')
        .insert({
          company_id: formData.company_id,
          asset_id: formData.asset_id,
          canal: formData.canal,
          titulo: formData.titulo,
          descricao: formData.descricao,
          solicitante_id: profile!.id,
          tecnico_id: profile!.id,
          status: 'em_atendimento',
          impacto: 'medio',
          urgencia: 'media',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Registro criado!',
        description: `Chamado #${ticketData.numero} foi criado com sucesso`,
      });

      onSuccess?.();
      onOpenChange(false);
      navigate(`/tickets/${ticketData.id}`);
    } catch (error: any) {
      console.error('Erro ao criar registro:', error);
      toast({
        title: 'Erro ao criar registro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registro Rápido de Atendimento</DialogTitle>
          <DialogDescription>
            Crie um chamado rapidamente para registrar um atendimento
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Empresa *</Label>
              <Select
                required
                value={formData.company_id}
                onValueChange={handleCompanyChange}
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
              <Label htmlFor="canal">Canal *</Label>
              <Select
                required
                value={formData.canal}
                onValueChange={(value: any) => setFormData({ ...formData, canal: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="visita_tecnica">Visita Técnica</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="web">Portal Web</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset">Ativo/Equipamento *</Label>
            <Select
              required
              value={formData.asset_id}
              onValueChange={(value) => setFormData({ ...formData, asset_id: value })}
              disabled={!formData.company_id}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !formData.company_id 
                    ? "Selecione uma empresa primeiro" 
                    : "Selecione o equipamento"
                } />
              </SelectTrigger>
              <SelectContent>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.nome} - {asset.tipo} {asset.tag_patrimonial && `(${asset.tag_patrimonial})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              required
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Resumo do atendimento"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              required
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva o atendimento realizado"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Registro'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
