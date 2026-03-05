import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

import { PhoneVisibilitySettings } from '@/components/profile/PhoneVisibilitySettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
  });

  useEffect(() => {
    if (!profile) {
      navigate('/auth');
      return;
    }

    setFormData({
      nome: profile.nome || '',
      telefone: profile.telefone || '',
    });
  }, [profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        nome: formData.nome,
        telefone: formData.telefone,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error('Erro ao atualizar perfil', {
        description: error.message,
      });
    } else {
      toast.success('Perfil atualizado com sucesso');
    }
    setLoading(false);
  };

  if (!profile) {
    return null;
  }

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">Configurações de Perfil</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
              <CardDescription>
                Atualize suas informações de perfil
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData({ ...formData, nome: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) =>
                      setFormData({ ...formData, telefone: e.target.value })
                    }
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Privacidade</CardTitle>
              <CardDescription>
                Controle quem pode ver suas informações de contato
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PhoneVisibilitySettings />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
