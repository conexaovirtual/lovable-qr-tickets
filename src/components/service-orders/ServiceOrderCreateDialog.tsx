import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  company_id: z.string().min(1, "Selecione uma empresa"),
  asset_id: z.string().optional(),
  equipamento_descricao: z.string().optional(),
  tipo_servico: z.enum(["corretivo", "preventivo", "instalacao", "consultoria"], {
    message: "Selecione o tipo de serviço",
  }),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]).default("media"),
  descricao_servicos: z.string().min(10, "Descrição deve ter no mínimo 10 caracteres"),
  data_agendada: z.date({
    message: "Selecione a data do agendamento",
  }),
  hora_agendada: z.string().min(1, "Informe o horário"),
  tempo_estimado_horas: z.number().min(0.5, "Tempo mínimo: 0.5 horas").optional(),
  tecnico_id: z.string().optional(),
  endereco_atendimento: z.string().optional(),
  contato_local: z.string().optional(),
  telefone_contato: z.string().optional(),
  equipamentos_necessarios: z.array(z.string()).optional(),
  observacoes: z.string().optional(),
});

interface ServiceOrderCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedCompanyId?: string;
  preSelectedTicketId?: string;
  preSelectedAssetId?: string;
  preSelectedTipoServico?: string;
  preSelectedDescricao?: string;
  onSuccess?: () => void;
}

export function ServiceOrderCreateDialog({
  open,
  onOpenChange,
  preSelectedCompanyId,
  preSelectedTicketId,
  preSelectedAssetId,
  preSelectedTipoServico,
  preSelectedDescricao,
  onSuccess,
}: ServiceOrderCreateDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_id: preSelectedCompanyId || "",
      asset_id: preSelectedAssetId || "",
      tipo_servico: (preSelectedTipoServico as any) || "corretivo",
      prioridade: "media",
      descricao_servicos: preSelectedDescricao || "",
      data_agendada: new Date(),
      hora_agendada: "09:00",
      equipamentos_necessarios: [],
      observacoes: "",
    },
  });

  useEffect(() => {
    if (open) {
      loadCompanies();
      loadTechnicians();
      if (preSelectedCompanyId) {
        form.setValue("company_id", preSelectedCompanyId);
        loadCompanyDetails(preSelectedCompanyId);
        loadAssets(preSelectedCompanyId);
      } else if (preSelectedAssetId) {
        // Load company from asset
        loadCompanyFromAsset(preSelectedAssetId);
      }
      if (preSelectedAssetId) {
        form.setValue("asset_id", preSelectedAssetId);
      }
    }
  }, [open]);

  const loadCompanies = async () => {
    setLoadingCompanies(true);
    console.log('[ServiceOrderCreateDialog] Carregando empresas...');
    
    try {
      // Verificar se o usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[ServiceOrderCreateDialog] Usuário autenticado:', user?.id);
      
      const { data, error } = await supabase
        .from("companies")
        .select("id, nome_fantasia, endereco, tipo_contrato")
        .eq("status", true)
        .order("nome_fantasia");

      console.log('[ServiceOrderCreateDialog] Resultado da query:', { 
        data, 
        error, 
        count: data?.length 
      });

      if (error) {
        console.error('[ServiceOrderCreateDialog] Erro SQL:', error);
        toast({
          title: "Erro ao carregar empresas",
          description: error.message,
          variant: "destructive",
        });
        setCompanies([]);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('[ServiceOrderCreateDialog] Nenhuma empresa ativa encontrada');
        toast({
          title: "Aviso",
          description: "Nenhuma empresa ativa cadastrada no sistema",
        });
      }

      setCompanies(data || []);
    } catch (error: any) {
      console.error('[ServiceOrderCreateDialog] Erro ao carregar empresas:', error);
      toast({
        title: "Erro ao carregar empresas",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const loadTechnicians = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome")
      .in("id", 
        (await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "tecnico"))
          .data?.map(r => r.user_id) || []
      );

    if (error) {
      console.error("Erro ao carregar técnicos:", error);
      return;
    }

    setTechnicians(data || []);
  };

  const loadAssets = async (companyId: string) => {
    if (!companyId) {
      setAssets([]);
      return;
    }

    setLoadingAssets(true);
    try {
      const { data, error } = await supabase
        .from("assets")
        .select("id, nome, tipo, tag_patrimonial")
        .eq("company_id", companyId)
        .order("nome");

      if (error) {
        console.error("Erro ao carregar ativos:", error);
        toast({
          title: "Erro ao carregar ativos",
          description: error.message,
          variant: "destructive",
        });
        setAssets([]);
        return;
      }

      setAssets(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar ativos:", error);
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  };

  const loadCompanyDetails = async (companyId: string) => {
    const { data } = await supabase
      .from("companies")
      .select("*, tipo_contrato")
      .eq("id", companyId)
      .single();

    if (data) {
      setSelectedCompany(data);
      if (data.endereco) {
        form.setValue("endereco_atendimento", data.endereco);
      }
      if (data.telefone) {
        form.setValue("telefone_contato", data.telefone);
      }
      // Clear asset fields when switching company
      form.setValue("asset_id", "");
      form.setValue("equipamento_descricao", "");
    }
  };

  const loadCompanyFromAsset = async (assetId: string) => {
    const { data } = await supabase
      .from("assets")
      .select("company_id")
      .eq("id", assetId)
      .single();

    if (data?.company_id) {
      form.setValue("company_id", data.company_id);
      loadCompanyDetails(data.company_id);
      loadAssets(data.company_id);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Combinar data e hora
      const dataAgendada = new Date(values.data_agendada);
      const [horas, minutos] = values.hora_agendada.split(':');
      dataAgendada.setHours(parseInt(horas), parseInt(minutos), 0, 0);

      const insertData: any = {
        company_id: values.company_id,
        asset_id: values.asset_id || null,
        equipamento_descricao: values.equipamento_descricao || null,
        ticket_id: preSelectedTicketId || null,
        tipo_servico: values.tipo_servico,
        prioridade: values.prioridade,
        descricao_servicos: values.descricao_servicos,
        data_agendada: dataAgendada.toISOString(),
        hora_agendada: values.hora_agendada,
        tempo_estimado_horas: values.tempo_estimado_horas || 0,
        status: "agendada",
        data_emissao: new Date().toISOString(),
      };

      // Add optional fields
      if (values.tecnico_id) insertData.tecnico_id = values.tecnico_id;
      if (values.endereco_atendimento) insertData.endereco_atendimento = values.endereco_atendimento;
      if (values.contato_local) insertData.contato_local = values.contato_local;
      if (values.telefone_contato) insertData.telefone_contato = values.telefone_contato;
      if (values.equipamentos_necessarios) insertData.equipamentos_necessarios = values.equipamentos_necessarios;
      if (values.observacoes) insertData.observacoes = values.observacoes;

      const { data: osData, error: osError } = await supabase
        .from("service_orders")
        .insert(insertData)
        .select()
        .single();

      if (osError) throw osError;

      // Se veio de um ticket, atualizar status do ticket
      if (preSelectedTicketId) {
        await supabase
          .from('tickets')
          .update({ status: 'em_atendimento' })
          .eq('id', preSelectedTicketId);
      }

      // Registrar no histórico
      await supabase.from("service_order_history").insert({
        service_order_id: osData.id,
        changed_by: user.id,
        campo_alterado: "status",
        valor_anterior: null,
        valor_novo: "agendada",
        observacao: "OS criada",
      });

      // Notificar cliente via WhatsApp (fire and forget)
      supabase.functions.invoke("notify-os-status", {
        body: {
          service_order_id: osData.id,
          new_status: "agendada",
        },
      }).then(res => {
        if (res.error) console.error("Erro ao notificar cliente:", res.error);
      }).catch(err => console.error("Erro ao chamar notify-os-status:", err));

      toast({
        title: "Ordem de Serviço criada!",
        description: `OS #${osData.numero_os} agendada para ${format(dataAgendada, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      form.reset();
      setStep(1);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao criar OS:", error);
      toast({
        title: "Erro ao criar OS",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
    console.log('[ServiceOrderCreateDialog] Tentando avançar do step:', step);
    const fields = getFieldsForStep(step);
    console.log('[ServiceOrderCreateDialog] Campos a validar:', fields);
    
    const isValid = await form.trigger(fields);
    const errors = form.formState.errors;
    
    console.log('[ServiceOrderCreateDialog] Validação:', { isValid, errors });
    
    if (!isValid) {
      // Mapear nomes dos campos para exibição
      const fieldNames: Record<string, string> = {
        company_id: "Empresa",
        tipo_servico: "Tipo de Serviço",
        prioridade: "Prioridade",
        descricao_servicos: "Descrição do Serviço",
        data_agendada: "Data do Agendamento",
        hora_agendada: "Horário",
      };
      
      // Listar os campos com erro
      const errorFields = fields
        .filter(field => errors[field])
        .map(field => {
          const message = errors[field]?.message;
          return `• ${fieldNames[field]}: ${message}`;
        });
      
      toast({
        title: "Campos obrigatórios não preenchidos",
        description: errorFields.length > 0 
          ? errorFields.join('\n')
          : "Preencha todos os campos obrigatórios antes de continuar.",
        variant: "destructive",
        duration: 5000,
      });
      
      // Scroll para o primeiro campo com erro
      const firstErrorField = fields.find(field => errors[field]);
      if (firstErrorField) {
        setTimeout(() => {
          const element = document.querySelector(`[name="${firstErrorField}"]`);
          element?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          // Focar no campo se possível
          if (element instanceof HTMLElement) {
            element.focus();
          }
        }, 100);
      }
      
      return;
    }
    
    console.log('[ServiceOrderCreateDialog] ✅ Avançando para step:', step + 1);
    setStep(step + 1);
  };

  const getFieldsForStep = (currentStep: number): (keyof z.infer<typeof formSchema>)[] => {
    switch (currentStep) {
      case 1:
        return ["company_id", "tipo_servico", "prioridade", "descricao_servicos"];
      case 2:
        return ["data_agendada", "hora_agendada"];
      case 3:
        return [];
      default:
        return [];
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Serviço - Etapa {step}/4</DialogTitle>
          <DialogDescription>
            {step === 1 && "Informe os dados básicos do serviço"}
            {step === 2 && "Defina o agendamento e responsável"}
            {step === 3 && "Informações de localização e contato"}
            {step === 4 && "Detalhes técnicos e observações"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {step === 1 && (
              <>
                <FormField
                  control={form.control}
                  name="company_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa Cliente *</FormLabel>
                      <Select 
                        disabled={loadingCompanies || companies.length === 0}
                     onValueChange={(value) => {
                          console.log('[ServiceOrderCreateDialog] Empresa selecionada:', value);
                          field.onChange(value);
                          const company = companies.find(c => c.id === value);
                          setSelectedCompany(company || null);
                          loadCompanyDetails(value);
                          loadAssets(value);
                          form.setValue("asset_id", "");
                          form.setValue("equipamento_descricao", "");
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={
                              loadingCompanies 
                                ? "Carregando empresas..." 
                                : companies.length === 0
                                  ? "Nenhuma empresa disponível"
                                  : "Selecione a empresa"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="z-[100]">
                          {companies.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              Nenhuma empresa disponível
                            </div>
                          ) : (
                            companies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.nome_fantasia}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Show asset select for contract companies, text input for eventual */}
                {selectedCompany?.tipo_contrato === 'contrato_manutencao' ? (
                  <FormField
                    control={form.control}
                    name="asset_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ativo/Equipamento</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!form.watch("company_id") || loadingAssets}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={
                                !form.watch("company_id") 
                                  ? "Selecione uma empresa primeiro" 
                                  : loadingAssets
                                    ? "Carregando ativos..."
                                    : assets.length === 0
                                      ? "Nenhum ativo disponível"
                                      : "Selecione o ativo"
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="z-[100]">
                            {assets.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground text-center">
                                Nenhum ativo disponível para esta empresa
                              </div>
                            ) : (
                              assets.map((asset) => (
                                <SelectItem key={asset.id} value={asset.id}>
                                  {asset.nome} - {asset.tipo}
                                  {asset.tag_patrimonial && ` (${asset.tag_patrimonial})`}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="equipamento_descricao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipamento (descrição manual)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: Notebook Dell Inspiron, PC da recepção..." 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Empresa eventual — descreva o equipamento manualmente
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="tipo_servico"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Tipo de Serviço *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-wrap gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="corretivo" id="corretivo" />
                            <label htmlFor="corretivo" className="cursor-pointer">Corretivo</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="preventivo" id="preventivo" />
                            <label htmlFor="preventivo" className="cursor-pointer">Preventivo</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="instalacao" id="instalacao" />
                            <label htmlFor="instalacao" className="cursor-pointer">Instalação</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="consultoria" id="consultoria" />
                            <label htmlFor="consultoria" className="cursor-pointer">Consultoria</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="prioridade"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Prioridade</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-wrap gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="baixa" id="baixa" />
                            <label htmlFor="baixa" className="cursor-pointer">Baixa</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="media" id="media" />
                            <label htmlFor="media" className="cursor-pointer">Média</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="alta" id="alta" />
                            <label htmlFor="alta" className="cursor-pointer">Alta</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="urgente" id="urgente" />
                            <label htmlFor="urgente" className="cursor-pointer">Urgente</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descricao_servicos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição do Serviço *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva detalhadamente o serviço a ser realizado..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Mínimo de 10 caracteres ({field.value?.length || 0}/10)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {step === 2 && (
              <>
                <FormField
                  control={form.control}
                  name="data_agendada"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data do Agendamento *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: ptBR })
                              ) : (
                                <span>Selecione a data</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hora_agendada"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário *</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tempo_estimado_horas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tempo Estimado (horas)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          placeholder="Ex: 2.5"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
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
                      <FormLabel>Técnico Responsável</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um técnico" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
              </>
            )}

            {step === 3 && (
              <>
                <FormField
                  control={form.control}
                  name="endereco_atendimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço do Atendimento</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Endereço completo..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contato_local"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contato no Local</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do responsável no local" {...field} />
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
                        <Input placeholder="(11) 98765-4321" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {step === 4 && (
              <>
                <FormField
                  control={form.control}
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Informações adicionais, requisitos especiais, etc."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <h4 className="font-semibold">Resumo da OS</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>Empresa:</strong> {companies.find(c => c.id === form.watch("company_id"))?.nome_fantasia || "Não selecionada"}</p>
                    <p><strong>Tipo:</strong> {form.watch("tipo_servico") || "Não definido"}</p>
                    <p>
                      <strong>Data:</strong> {(() => {
                        const dataAgendada = form.watch("data_agendada");
                        const horaAgendada = form.watch("hora_agendada");
                        if (dataAgendada && dataAgendada instanceof Date && !isNaN(dataAgendada.getTime())) {
                          return `${format(dataAgendada, "dd/MM/yyyy", { locale: ptBR })} às ${horaAgendada || "Não definida"}`;
                        }
                        return "Data não definida";
                      })()}
                    </p>
                    <p><strong>Técnico:</strong> {technicians.find(t => t.id === form.watch("tecnico_id"))?.nome || "Não atribuído"}</p>
                  </div>
                </div>
              </>
            )}

            <DialogFooter>
              <div className="flex justify-between w-full">
                <div>
                  {step > 1 && (
                    <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      console.log('=== DEBUG FORM STATE ===');
                      console.log('Current step:', step);
                      console.log('Form values:', form.getValues());
                      console.log('Form errors:', form.formState.errors);
                      console.log('Form valid:', form.formState.isValid);
                      console.log('Form dirty:', form.formState.isDirty);
                      console.log('======================');
                    }}
                  >
                    Debug
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  {step < 4 ? (
                    <Button type="button" onClick={nextStep}>
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={loading}>
                      {loading ? "Criando..." : "Criar OS"}
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}