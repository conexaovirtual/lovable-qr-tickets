import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, AlertCircle, QrCode } from 'lucide-react';
import { ticketSchema, type TicketFormData } from '@/lib/validations';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function NewTicket() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [lastSubmit, setLastSubmit] = useState<number>(0);
  const [selectedAssetInfo, setSelectedAssetInfo] = useState<any>(null);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  const preSelectedAssetId = searchParams.get('ativo');
  const preSelectedCompanyId = searchParams.get('empresa');
  const qrCodeToken = searchParams.get('token');

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    category_id: '',
    subcategory_id: '',
    asset_id: preSelectedAssetId || '',
    company_id: preSelectedCompanyId || '',
    impacto: 'medio' as const,
    urgencia: 'media' as const,
    tecnico_id: '',
  });

  useEffect(() => {
    // Se veio de QR Code mas não está autenticado, redirecionar para login
    if ((preSelectedAssetId || qrCodeToken) && !profile && !authLoading) {
      const currentParams = new URLSearchParams(searchParams);
      const returnUrl = `/tickets/new?${currentParams.toString()}`;
      navigate(`/auth?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    // Aguardar carregamento do profile
    if (authLoading) return;
    
    if (!profile) return;

    loadCategories();
    
    // Validar token do QR Code se presente
    if (preSelectedAssetId && qrCodeToken) {
      validateQRCodeToken();
    }
    
    // Se for admin/técnico, carregar empresas e técnicos
    if (profile?.roles.includes('admin_provedor') || profile?.roles.includes('tecnico')) {
      loadCompanies();
      loadTechnicians();
      // Se já veio empresa pré-selecionada
      if (preSelectedCompanyId) {
        setSelectedCompanyId(preSelectedCompanyId);
      }
    } else if (profile?.company_id) {
      // Usuário comum: carregar ativos da própria empresa
      setSelectedCompanyId(profile.company_id);
      setFormData(prev => ({ ...prev, company_id: profile.company_id! }));
    }
  }, [profile, authLoading, preSelectedAssetId, qrCodeToken, searchParams, navigate]);

  useEffect(() => {
    if (selectedCompanyId) {
      loadAssets(selectedCompanyId);
    } else {
      setAssets([]);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    if (formData.category_id) {
      loadSubcategories(formData.category_id);
    }
  }, [formData.category_id]);

  const loadCategories = async () => {
    const { data } = await supabase.from('categories').select('*');
    if (data) setCategories(data);
  };

  const loadSubcategories = async (categoryId: string) => {
    const { data } = await supabase
      .from('subcategories')
      .select('*')
      .eq('category_id', categoryId);
    if (data) setSubcategories(data);
  };

  const loadCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, nome_fantasia')
      .eq('status', true)
      .order('nome_fantasia');
    if (data) setCompanies(data);
  };

  const loadTechnicians = async () => {
    // SECURITY: Query user_roles table to prevent privilege escalation
    const { data: userRolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin_provedor', 'tecnico']);

    if (rolesError || !userRolesData || userRolesData.length === 0) {
      console.error('Erro ao carregar roles:', rolesError);
      setTechnicians([]);
      return;
    }

    // Get user IDs
    const technicianIds = userRolesData.map(ur => ur.user_id);

    // Fetch profiles for these users
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, nome')
      .in('id', technicianIds);

    if (profilesError) {
      console.error('Erro ao carregar profiles:', profilesError);
      setTechnicians([]);
      return;
    }

    if (profilesData) {
      const techs = profilesData.map(profile => ({
        id: profile.id,
        nome: profile.nome
      }));
      setTechnicians(techs);
    }
  };

  const loadAssets = async (companyId: string) => {
    const { data } = await supabase
      .from('assets')
      .select(`
        *,
        company:companies(nome_fantasia)
      `)
      .eq('company_id', companyId)
      .neq('estado', 'baixado');
    if (data) setAssets(data);
  };

  const validateQRCodeToken = async () => {
    if (!preSelectedAssetId || !qrCodeToken) return;

    const { data: asset, error } = await supabase
      .from('assets')
      .select(`
        *,
        company:companies(nome_fantasia)
      `)
      .eq('id', preSelectedAssetId)
      .eq('qrcode_token', qrCodeToken)
      .single();

    if (error || !asset) {
      setTokenError(true);
      toast({
        title: 'QR Code inválido',
        description: 'O código QR escaneado não é válido ou expirou',
        variant: 'destructive',
      });
      return;
    }

    setTokenValid(true);
    setSelectedAssetInfo(asset);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Validar token se vier de QR Code
    if (preSelectedAssetId && qrCodeToken && !tokenValid) {
      toast({
        title: 'QR Code inválido',
        description: 'O código QR escaneado não é válido',
        variant: 'destructive',
      });
      return;
    }

    // Rate limiting: prevent ticket spam (10 seconds between submissions)
    const now = Date.now();
    if (now - lastSubmit < 10000) {
      toast({
        title: 'Aguarde',
        description: 'Aguarde alguns segundos antes de criar outro chamado',
        variant: 'destructive',
      });
      return;
    }

    // Validar formulário
    try {
      ticketSchema.parse(formData);
      
      // Validação adicional: Técnico obrigatório para admins/técnicos
      if (profile?.roles.includes('admin_provedor') || profile?.roles.includes('tecnico')) {
        if (!formData.tecnico_id || formData.tecnico_id === 'none') {
          setValidationErrors({ tecnico_id: 'Selecione um técnico responsável' });
          toast({
            title: 'Campo obrigatório',
            description: 'Você precisa atribuir um técnico responsável ao chamado',
            variant: 'destructive',
          });
          return;
        }
      }
      
      setValidationErrors({});
      setLastSubmit(now);
    } catch (error: any) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err: any) => {
        errors[err.path[0]] = err.message;
      });
      setValidationErrors(errors);
      toast({
        title: 'Erro de validação',
        description: 'Verifique os campos destacados',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('tickets').insert({
      ...formData,
      asset_id: formData.asset_id === 'none' ? null : formData.asset_id || null,
      tecnico_id: formData.tecnico_id || null,
      company_id: formData.company_id,
      solicitante_id: profile.id,
      canal: preSelectedAssetId ? 'qrcode' : 'web',
    });

    if (error) {
      toast({
        title: 'Erro ao criar chamado',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Chamado criado com sucesso',
      });
      navigate('/tickets');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Novo Chamado</h1>
          <p className="text-muted-foreground">Preencha os dados do chamado técnico</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {tokenError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                QR Code inválido. Por favor, escaneie novamente ou crie o chamado manualmente.
              </AlertDescription>
            </Alert>
          )}

          {tokenValid && selectedAssetInfo && (
            <Alert>
              <QrCode className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Chamado via QR Code</p>
                  <div className="text-sm space-y-0.5">
                    <p><span className="text-muted-foreground">Ativo:</span> {selectedAssetInfo.tipo}</p>
                    {selectedAssetInfo.tag_patrimonial && (
                      <p><span className="text-muted-foreground">Tag:</span> {selectedAssetInfo.tag_patrimonial}</p>
                    )}
                    <p><span className="text-muted-foreground">Empresa:</span> {selectedAssetInfo.company?.nome_fantasia}</p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {Object.keys(validationErrors).length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Por favor, corrija os erros no formulário antes de continuar.
              </AlertDescription>
            </Alert>
          )}

          {/* Campo Empresa - Apenas para admins/técnicos */}
          {(profile?.roles.includes('admin_provedor') || profile?.roles.includes('tecnico')) && (
            <div className="space-y-2">
              <Label htmlFor="company">Empresa *</Label>
              <Select
                required
                value={formData.company_id}
                onValueChange={(value) => {
                  setFormData({ ...formData, company_id: value, asset_id: '' });
                  setSelectedCompanyId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa cliente" />
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
          )}

          {/* Campo Técnico Responsável - OBRIGATÓRIO para admins/técnicos */}
          {(profile?.roles.includes('admin_provedor') || profile?.roles.includes('tecnico')) && (
            <div className="space-y-2">
              <Label htmlFor="tecnico">
                Técnico Responsável <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.tecnico_id}
                onValueChange={(value) => setFormData({ ...formData, tecnico_id: value })}
                required
              >
                <SelectTrigger className={validationErrors.tecnico_id ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione um técnico responsável" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.tecnico_id && (
                <p className="text-sm text-destructive">{validationErrors.tecnico_id}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Este campo é obrigatório para garantir atendimento ágil
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              required
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Resumo do problema"
              className={validationErrors.titulo ? 'border-destructive' : ''}
            />
            {validationErrors.titulo && (
              <p className="text-sm text-destructive">{validationErrors.titulo}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              required
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva o problema em detalhes"
              rows={5}
              className={validationErrors.descricao ? 'border-destructive' : ''}
            />
            {validationErrors.descricao && (
              <p className="text-sm text-destructive">{validationErrors.descricao}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria *</Label>
              <Select
                required
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value, subcategory_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
              <Label htmlFor="subcategory">Subcategoria</Label>
              <Select
                value={formData.subcategory_id}
                onValueChange={(value) => setFormData({ ...formData, subcategory_id: value })}
                disabled={!formData.category_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset">Ativo</Label>
            <Select
              value={formData.asset_id}
              onValueChange={(value) => setFormData({ ...formData, asset_id: value })}
              disabled={!!preSelectedAssetId || !selectedCompanyId}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !selectedCompanyId
                    ? "Selecione uma empresa primeiro"
                    : assets.length === 0 
                      ? "Nenhum ativo disponível" 
                      : "Selecione o equipamento (opcional)"
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.tipo} - {asset.tag_patrimonial || asset.numero_serie}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="impacto">Impacto *</Label>
              <Select
                required
                value={formData.impacto}
                onValueChange={(value: any) => setFormData({ ...formData, impacto: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="urgencia">Urgência *</Label>
              <Select
                required
                value={formData.urgencia}
                onValueChange={(value: any) => setFormData({ ...formData, urgencia: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Criando...' : 'Criar Chamado'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
