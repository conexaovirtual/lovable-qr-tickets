import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Plus, Sparkles, Check, X, Loader2 } from 'lucide-react';
import { AssetDialog } from '@/components/assets/AssetDialog';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';

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
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [isCategorizingVoice, setIsCategorizingVoice] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    titulo: string;
    descricao_formatada: string;
  } | null>(null);
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

  // Função para processar transcrição de voz
  const handleVoiceTranscript = async (transcript: string) => {
    if (!transcript.trim()) return;
    
    setIsCategorizingVoice(true);
    setAiSuggestion(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-ticket-categorizer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ transcription: transcript }),
        }
      );

      if (!response.ok) throw new Error('Falha na categorização');

      const data = await response.json();
      
      if (data.success && data.categorization) {
        setAiSuggestion({
          titulo: data.categorization.titulo,
          descricao_formatada: data.categorization.descricao_formatada,
        });
      } else {
        setFormData(prev => ({ ...prev, descricao: transcript }));
      }
    } catch (error) {
      console.error('Erro ao categorizar:', error);
      setFormData(prev => ({ ...prev, descricao: transcript }));
    } finally {
      setIsCategorizingVoice(false);
    }
  };

  // Aceitar sugestão da IA
  const acceptAiSuggestion = () => {
    if (!aiSuggestion) return;
    setFormData(prev => ({
      ...prev,
      titulo: aiSuggestion.titulo,
      descricao: aiSuggestion.descricao_formatada,
    }));
    setAiSuggestion(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {

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
            <div className="flex items-center justify-between">
              <Label htmlFor="asset">Ativo/Equipamento *</Label>
              {formData.company_id && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setShowAssetDialog(true)}
                  className="h-auto p-0 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Cadastrar Novo
                </Button>
              )}
            </div>
            
            <Select
              value={formData.asset_id}
              onValueChange={(value) => setFormData({ ...formData, asset_id: value })}
              disabled={!formData.company_id}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !formData.company_id 
                    ? "Selecione uma empresa primeiro" 
                    : assets.length === 0
                      ? "Nenhum ativo disponível - Clique em 'Cadastrar Novo'"
                      : "Selecione o ativo"
                } />
              </SelectTrigger>
              <SelectContent>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.nome} - {asset.tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {assets.length === 0 && formData.company_id && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Esta empresa não possui ativos cadastrados.{' '}
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => setShowAssetDialog(true)}
                    className="h-auto p-0 underline"
                  >
                    Clique aqui para cadastrar
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Card de Sugestão da IA */}
          {aiSuggestion && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  IA Sugeriu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Título:</span>{' '}
                  <span className="font-medium">{aiSuggestion.titulo}</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={acceptAiSuggestion}>
                    <Check className="h-4 w-4 mr-1" />
                    Aceitar
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setAiSuggestion(null)}>
                    <X className="h-4 w-4 mr-1" />
                    Ignorar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading da categorização por voz */}
          {isCategorizingVoice && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando com IA...
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="titulo">Título *</Label>
              <VoiceInputButton
                onFinalResult={handleVoiceTranscript}
                disabled={isCategorizingVoice}
                size="sm"
              />
            </div>
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

      {/* Dialog de Criação de Ativo */}
      <AssetDialog
        open={showAssetDialog}
        onOpenChange={setShowAssetDialog}
        preSelectedCompanyId={formData.company_id}
        onSuccess={(newAssetId) => {
          if (newAssetId && formData.company_id) {
            loadAssets(formData.company_id);
            setFormData({ ...formData, asset_id: newAssetId });
            toast({
              title: 'Ativo cadastrado!',
              description: 'O ativo foi selecionado automaticamente',
            });
          }
          setShowAssetDialog(false);
        }}
      />
    </DialogContent>
  </Dialog>
  );
}
