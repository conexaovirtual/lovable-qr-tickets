import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { companySchema, type CompanyFormData } from '@/lib/validations';
import { formatCNPJ, formatPhone } from '@/lib/formatters';
import { useCNPJLookup } from '@/hooks/useCNPJLookup';
import { Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: any;
  onSuccess?: () => void;
}

export function CompanyDialog({ open, onOpenChange, company, onSuccess }: CompanyDialogProps) {
  const { toast } = useToast();
  const { lookupCNPJ, isLoading: isLoadingCNPJ } = useCNPJLookup();
  const [cnpjValidated, setCnpjValidated] = useState(false);
  const [companySituation, setCompanySituation] = useState<'ativa' | 'baixada' | null>(null);
  
  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      nome_fantasia: '',
      razao_social: '',
      cnpj: '',
      email: '',
      telefone: '',
      endereco: '',
      status: true,
      sla_primeiro_atendimento_horas: 4,
      sla_solucao_horas: 16,
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        nome_fantasia: company.nome_fantasia || '',
        razao_social: company.razao_social || '',
        cnpj: company.cnpj || '',
        email: company.email || '',
        telefone: company.telefone || '',
        endereco: company.endereco || '',
        status: company.status ?? true,
        sla_primeiro_atendimento_horas: company.sla_primeiro_atendimento_horas || 4,
        sla_solucao_horas: company.sla_solucao_horas || 16,
      });
    } else {
      form.reset({
        nome_fantasia: '',
        razao_social: '',
        cnpj: '',
        email: '',
        telefone: '',
        endereco: '',
        status: true,
        sla_primeiro_atendimento_horas: 4,
        sla_solucao_horas: 16,
      });
      setCnpjValidated(false);
      setCompanySituation(null);
    }
  }, [company, form]);

  const handleCNPJLookup = async () => {
    const cnpj = form.getValues('cnpj');
    
    if (!cnpj || cnpj.replace(/[^\d]/g, '').length !== 14) {
      toast({
        title: 'CNPJ inválido',
        description: 'Digite um CNPJ válido com 14 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    const data = await lookupCNPJ(cnpj);
    
    if (data) {
      form.setValue('razao_social', data.razao_social);
      form.setValue('nome_fantasia', data.nome_fantasia);
      form.setValue('endereco', data.endereco_completo);
      if (data.telefone) form.setValue('telefone', data.telefone);
      if (data.email) form.setValue('email', data.email);
      
      setCnpjValidated(true);
      setCompanySituation(data.ativa ? 'ativa' : 'baixada');
      
      toast({
        title: '✓ Dados encontrados',
        description: 'Os campos foram preenchidos automaticamente.',
      });
      
      if (!data.ativa) {
        toast({
          title: '⚠ Atenção',
          description: 'Esta empresa está com situação cadastral BAIXADA na Receita Federal.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleCNPJBlur = () => {
    const cnpj = form.getValues('cnpj');
    const nome = form.getValues('nome_fantasia');
    const razao = form.getValues('razao_social');
    
    // Busca automática apenas se CNPJ válido e campos vazios
    if (cnpj && 
        cnpj.replace(/[^\d]/g, '').length === 14 && 
        !nome && 
        !razao && 
        !company) {
      handleCNPJLookup();
    }
  };

  const onSubmit = async (data: CompanyFormData) => {
    try {
      // Remover campos vazios opcionais antes de enviar
      const cleanedData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value === '' || value === null || value === undefined) {
          return acc;
        }
        return { ...acc, [key]: value };
      }, {} as any);

      if (company) {
        const { error } = await supabase
          .from('companies')
          .update(cleanedData)
          .eq('id', company.id);

        if (error) throw error;

        toast({
          title: 'Empresa atualizada',
          description: 'Os dados foram salvos com sucesso.',
        });
      } else {
        // Validação client-side: verificar se empresa já existe
        // SECURITY FIX: Use separate queries instead of .or() to prevent SQL injection
        const [existingByCnpj, existingByName] = await Promise.all([
          supabase
            .from('companies')
            .select('id, nome_fantasia')
            .eq('cnpj', data.cnpj)
            .maybeSingle(),
          supabase
            .from('companies')
            .select('id, cnpj')
            .eq('nome_fantasia', data.nome_fantasia)
            .maybeSingle()
        ]);

        if (existingByCnpj.data) {
          toast({
            title: 'CNPJ já cadastrado',
            description: `Já existe uma empresa com este CNPJ: ${existingByCnpj.data.nome_fantasia}`,
            variant: 'destructive',
          });
          return;
        }

        if (existingByName.data) {
          toast({
            title: 'Nome fantasia já cadastrado',
            description: `Já existe uma empresa com este nome: ${existingByName.data.cnpj || 'CNPJ não informado'}`,
            variant: 'destructive',
          });
          return;
        }

        const { error } = await supabase
          .from('companies')
          .insert([cleanedData]);

        if (error) throw error;

        toast({
          title: 'Empresa criada',
          description: 'A empresa foi cadastrada com sucesso.',
        });
      }

      onOpenChange(false);
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      let errorMessage = error.message;
      
      // Detectar erro de constraint UNIQUE do banco
      if (error.code === '23505') {
        if (error.message.includes('companies_cnpj_unique_idx')) {
          errorMessage = 'Este CNPJ já está cadastrado.';
        } else if (error.message.includes('companies_nome_fantasia_unique')) {
          errorMessage = 'Já existe uma empresa com este nome.';
        }
      }
      
      toast({
        title: 'Erro ao salvar empresa',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {company ? 'Editar Empresa' : 'Nova Empresa'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nome_fantasia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Fantasia *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome da empresa" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="razao_social"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razão Social</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Razão social" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      CNPJ
                      {cnpjValidated && companySituation === 'ativa' && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      {cnpjValidated && companySituation === 'baixada' && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="00.000.000/0000-00"
                          disabled={!!company}
                          onChange={(e) => {
                            const formatted = formatCNPJ(e.target.value);
                            field.onChange(formatted);
                            setCnpjValidated(false);
                            setCompanySituation(null);
                          }}
                          onBlur={handleCNPJBlur}
                        />
                      </FormControl>
                      {!company && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleCNPJLookup}
                          disabled={isLoadingCNPJ || !field.value || field.value.replace(/[^\d]/g, '').length !== 14}
                          title="Buscar dados da empresa"
                        >
                          {isLoadingCNPJ ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="contato@empresa.com" />
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
                      <Input 
                        {...field} 
                        placeholder="(00) 00000-0000"
                        onChange={(e) => {
                          const formatted = formatPhone(e.target.value);
                          field.onChange(formatted);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endereco"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Rua, número, bairro, cidade" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sla_primeiro_atendimento_horas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SLA Primeiro Atendimento (horas)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        min="1"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 4)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sla_solucao_horas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SLA Solução (horas)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        min="1"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 16)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Empresa Ativa</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Salvando...' : (company ? 'Salvar' : 'Criar')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
