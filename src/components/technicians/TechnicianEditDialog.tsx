import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Info } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

// Configure zxcvbn
const options = {
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
  },
};
zxcvbnOptions.setOptions(options);

const formSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  telefone: z.string().optional(),
  company_id: z.string().optional(),
  password: z.string().optional().refine((val) => {
    if (!val || val.length === 0) return true;
    return val.length >= 6;
  }, 'A senha deve ter pelo menos 6 caracteres'),
});

type FormData = z.infer<typeof formSchema>;

interface TechnicianEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technician: {
    id: string;
    nome: string;
    telefone?: string;
    company_id?: string;
  };
  onSuccess: () => void;
}

export function TechnicianEditDialog({
  open,
  onOpenChange,
  technician,
  onSuccess,
}: TechnicianEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; nome_fantasia: string }[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: technician.nome || '',
      telefone: technician.telefone || '',
      company_id: technician.company_id || '__all__',
      password: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nome: technician.nome || '',
        telefone: technician.telefone || '',
        company_id: technician.company_id || '__all__',
        password: '',
      });
      loadCompanies();
    }
  }, [open, technician]);

  const loadCompanies = async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('id, nome_fantasia')
      .eq('status', true)
      .order('nome_fantasia');

    if (error) {
      console.error('Error loading companies:', error);
      return;
    }

    setCompanies(data || []);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await supabase.functions.invoke('update-user', {
        body: {
          user_id: technician.id,
          nome: data.nome,
          telefone: data.telefone || null,
          company_id: data.company_id === '__all__' ? null : data.company_id,
          password: data.password || null,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao atualizar técnico');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('Técnico atualizado com sucesso');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating technician:', error);
      toast.error(error.message || 'Erro ao atualizar técnico');
    } finally {
      setLoading(false);
    }
  };

  const password = form.watch('password');
  
  const passwordStrength = useMemo(() => {
    if (!password || password.length === 0) return 0;
    const result = zxcvbn(password);
    return result.score;
  }, [password]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Técnico</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do técnico" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input placeholder="(00) 00000-0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa Vinculada</FormLabel>
                  <Select
                    value={field.value || '__all__'}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Acesso a todas as empresas" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__all__">Acesso a todas as empresas</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.nome_fantasia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Deixe vazio para acesso multi-empresa
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  {password && password.length > 0 && (
                    <PasswordStrengthIndicator strength={passwordStrength} />
                  )}
                  <FormDescription className="flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Deixe em branco para manter a senha atual
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
