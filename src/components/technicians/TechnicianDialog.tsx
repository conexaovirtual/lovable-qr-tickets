import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

interface TechnicianDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TechnicianDialog({ open, onOpenChange, onSuccess }: TechnicianDialogProps) {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    password: '',
    company_id: '',
  });

  useEffect(() => {
    if (open) {
      loadCompanies();
    }
  }, [open]);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, nome_fantasia')
        .eq('status', true)
        .order('nome_fantasia');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      console.error('Error loading companies:', error);
      toast.error('Erro ao carregar empresas');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.email || !formData.password) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      // Verificar se o email já existe
      const { data, error: searchError } = await supabase.auth.admin.listUsers();
      
      if (searchError) {
        console.error('Error checking existing users:', searchError);
      } else if (data?.users) {
        const existingUser = data.users.find((u: any) => u.email === formData.email);
        if (existingUser) {
          toast.error('Este email já está cadastrado no sistema');
          setLoading(false);
          return;
        }
      }

      // Create user with metadata - the trigger will handle profile and role creation
      const { error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            nome: formData.nome,
            telefone: formData.telefone,
            company_id: formData.company_id || null, // null = todas as empresas
            role: 'tecnico',
          },
        },
      });

      if (authError) throw authError;

      const companyText = formData.company_id 
        ? 'Vinculado a uma empresa específica' 
        : 'Acesso a todas as empresas';
      
      toast.success(`Técnico ${formData.nome} cadastrado com sucesso!`, {
        description: companyText
      });
      
      setFormData({ nome: '', email: '', telefone: '', password: '', company_id: '' });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating technician:', error);
      
      // Mensagens específicas por tipo de erro
      if (error.message?.includes('already registered') || error.message?.includes('User already registered')) {
        toast.error('Email já cadastrado. Use outro email.');
      } else if (error.message?.includes('Invalid email')) {
        toast.error('Email inválido. Verifique o formato.');
      } else if (error.message?.includes('Password') || error.message?.includes('password')) {
        toast.error('Senha muito fraca. Use pelo menos 6 caracteres.');
      } else {
        toast.error(error.message || 'Erro ao cadastrar técnico');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Técnico</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Senha temporária"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Empresa</Label>
            <Select
              value={formData.company_id || 'all'}
              onValueChange={(value) => setFormData({ ...formData, company_id: value === 'all' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.nome_fantasia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cadastrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
