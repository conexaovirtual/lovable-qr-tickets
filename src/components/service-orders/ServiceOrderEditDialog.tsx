import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface ServiceOrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOrder: any;
  onSuccess?: () => void;
}

const editSchema = z.object({
  company_id: z.string().uuid({ message: "Empresa é obrigatória" }),
  tipo_servico: z.string().min(1, "Tipo de serviço é obrigatório"),
  prioridade: z.string().min(1, "Prioridade é obrigatória"),
  descricao_servicos: z.string().min(10, "Descrição deve ter no mínimo 10 caracteres"),
  data_agendada: z.string().min(1, "Data é obrigatória"),
  hora_agendada: z.string().min(1, "Hora é obrigatória"),
  tecnico_id: z.string().nullable(),
  endereco_atendimento: z.string().optional(),
  contato_local: z.string().optional(),
  telefone_contato: z.string().optional(),
  observacoes: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

export function ServiceOrderEditDialog({
  open,
  onOpenChange,
  serviceOrder,
  onSuccess,
}: ServiceOrderEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const { toast } = useToast();

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      company_id: "",
      tipo_servico: "corretivo",
      prioridade: "media",
      descricao_servicos: "",
      data_agendada: "",
      hora_agendada: "",
      tecnico_id: null,
      endereco_atendimento: "",
      contato_local: "",
      telefone_contato: "",
      observacoes: "",
    },
  });

  useEffect(() => {
    if (open) {
      try {
        loadCompanies();
        loadTechnicians();
        
        if (serviceOrder) {
          console.log('[ServiceOrderEditDialog] Service Order data:', serviceOrder);
          
          // Formatar data de forma segura
          let dataFormatada = "";
          if (serviceOrder.data_agendada) {
            try {
              const date = new Date(serviceOrder.data_agendada);
              dataFormatada = date.toISOString().split('T')[0];
            } catch (e) {
              console.error('[ServiceOrderEditDialog] Erro ao formatar data:', e);
            }
          }

          const formData = {
            company_id: serviceOrder.company_id || "",
            tipo_servico: serviceOrder.tipo_servico || "corretivo",
            prioridade: serviceOrder.prioridade || "media",
            descricao_servicos: serviceOrder.descricao_servicos || "",
            data_agendada: dataFormatada,
            hora_agendada: serviceOrder.hora_agendada || "",
            tecnico_id: serviceOrder.tecnico_id || null,
            endereco_atendimento: serviceOrder.endereco_atendimento || "",
            contato_local: serviceOrder.contato_local || "",
            telefone_contato: serviceOrder.telefone_contato || "",
            observacoes: serviceOrder.observacoes || "",
          };
          
          console.log('[ServiceOrderEditDialog] Resetting form with:', formData);
          form.reset(formData);
        }
      } catch (error) {
        console.error('[ServiceOrderEditDialog] Error in useEffect:', error);
        toast({
          title: "Erro ao carregar dados",
          description: "Ocorreu um erro ao carregar os dados da OS",
          variant: "destructive",
        });
      }
    }
  }, [open, serviceOrder]);

  const loadCompanies = async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, nome_fantasia")
      .eq("status", true)
      .order("nome_fantasia");
    console.log('[ServiceOrderEditDialog] Companies loaded:', data);
    setCompanies(data || []);
  };

  const loadTechnicians = async () => {
    try {
      // Buscar IDs de técnicos
      const { data: techRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "tecnico");
      
      if (rolesError) throw rolesError;
      
      const techIds = techRoles?.map(r => r.user_id) || [];
      
      console.log('[ServiceOrderEditDialog] Technician IDs:', techIds);
      
      if (techIds.length === 0) {
        console.warn('[ServiceOrderEditDialog] Nenhum técnico encontrado');
        setTechnicians([]);
        toast({
          title: "Aviso",
          description: "Nenhum técnico cadastrado no sistema",
          variant: "default",
        });
        return;
      }
      
      // Buscar perfis dos técnicos
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", techIds)
        .order("nome");
      
      if (profilesError) throw profilesError;
      
      console.log('[ServiceOrderEditDialog] Technicians loaded:', profiles);
      setTechnicians(profiles || []);
      
    } catch (error: any) {
      console.error('[ServiceOrderEditDialog] Error loading technicians:', error);
      toast({
        title: "Erro ao carregar técnicos",
        description: error.message,
        variant: "destructive",
      });
      setTechnicians([]);
    }
  };

  const onSubmit = async (data: EditFormData) => {
    console.log('[ServiceOrderEditDialog] Form data:', data);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const updateData = {
        ...data,
        tecnico_id: data.tecnico_id || null,
        updated_at: new Date().toISOString(),
      };

      console.log('[ServiceOrderEditDialog] Update data:', updateData);

      const { error: updateError } = await supabase
        .from("service_orders")
        .update(updateData)
        .eq("id", serviceOrder.id);

      if (updateError) throw updateError;

      await supabase.from("service_order_history").insert({
        service_order_id: serviceOrder.id,
        changed_by: user.id,
        campo_alterado: "edicao",
        valor_anterior: "Dados anteriores",
        valor_novo: "Dados atualizados",
        observacao: "OS editada",
      });

      toast({
        title: "OS atualizada!",
        description: `OS #${serviceOrder.numero_os} foi atualizada com sucesso.`,
      });

      onSuccess?.();
    } catch (error: any) {
      console.error("[ServiceOrderEditDialog] Erro ao atualizar OS:", error);
      console.error("[ServiceOrderEditDialog] Error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      toast({
        title: "Erro ao atualizar OS",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Ordem de Serviço #{serviceOrder?.numero_os}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Informações Básicas */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="company_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Empresa</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a empresa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.nome_fantasia}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo_servico"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Serviço</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="preventivo">Preventivo</SelectItem>
                        <SelectItem value="corretivo">Corretivo</SelectItem>
                        <SelectItem value="instalacao">Instalação</SelectItem>
                        <SelectItem value="consultoria">Consultoria</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prioridade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Descrição */}
            <FormField
              control={form.control}
              name="descricao_servicos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Serviço</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Agendamento */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="data_agendada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Agendada</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hora_agendada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora Agendada</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

                <FormField
                  control={form.control}
                  name="tecnico_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Técnico</FormLabel>
            <Select 
              onValueChange={(value) => field.onChange(value === "unassigned" ? null : value)} 
              value={field.value || "unassigned"}
              disabled={technicians.length === 0}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={
                    technicians.length === 0 
                      ? "Nenhum técnico disponível" 
                      : "Selecione"
                  } />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="unassigned">Não atribuído</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            {/* Local de Atendimento */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="endereco_atendimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço de Atendimento</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Endereço completo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contato_local"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contato no Local</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome do contato" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefone_contato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone de Contato</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="(00) 00000-0000" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Observações */}
            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Botões */}
            <div className="flex gap-2 justify-end">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => {
                  console.log('=== DEBUG EDIT FORM ===');
                  console.log('Service Order:', serviceOrder);
                  console.log('Form values:', form.getValues());
                  console.log('Form errors:', form.formState.errors);
                  console.log('Companies:', companies);
                  console.log('Technicians:', technicians);
                  console.log('======================');
                }}
              >
                Debug
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
