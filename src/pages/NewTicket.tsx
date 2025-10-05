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
import { ArrowLeft } from 'lucide-react';

export default function NewTicket() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);

  const preSelectedAssetId = searchParams.get('ativo');
  const preSelectedCompanyId = searchParams.get('empresa');

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    category_id: '',
    subcategory_id: '',
    asset_id: preSelectedAssetId || '',
    impacto: 'medio' as const,
    urgencia: 'media' as const,
  });

  useEffect(() => {
    loadCategories();
    if (profile?.company_id) {
      loadAssets();
    }
  }, [profile]);

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

  const loadAssets = async () => {
    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('company_id', profile?.company_id!)
      .neq('estado', 'baixado');
    if (data) setAssets(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);
    const { error } = await supabase.from('tickets').insert({
      ...formData,
      company_id: profile.company_id!,
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
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              required
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Resumo do problema"
            />
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
            />
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
              disabled={!!preSelectedAssetId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o equipamento (opcional)" />
              </SelectTrigger>
              <SelectContent>
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
