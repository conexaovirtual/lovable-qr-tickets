import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { UploadedImage } from "@/lib/imageUtils";
import { toast } from "sonner";
import { Loader2, MessageCircle, Phone, MapPin, FileDown } from "lucide-react";
import { format } from "date-fns";
import { exportSingleDailyServiceToPDF } from "@/lib/exportSingleDailyService";

const canalEnum = z.union([
  z.literal("whatsapp"),
  z.literal("ligacao"),
  z.literal("visita_tecnica"),
]);

const statusEnum = z.union([
  z.literal("em_andamento"),
  z.literal("concluido"),
  z.literal("pendente"),
]);

const formSchema = z.object({
  company_id: z.string().min(1, "Selecione uma empresa"),
  asset_id: z.string().min(1, "Selecione o ativo"),
  data_atendimento: z.string().min(1, "Data é obrigatória"),
  hora_inicio: z.string().min(1, "Horário de início é obrigatório"),
  hora_fim: z.string().optional(),
  canal: canalEnum,
  titulo: z.string().min(5, "Título deve ter no mínimo 5 caracteres"),
  descricao: z.string().min(20, "Descrição deve ter no mínimo 20 caracteres"),
  solucao: z.string().optional(),
  status: statusEnum,
  observacoes: z.string().optional(),
}).refine(
  (data) => {
    if (data.hora_fim && data.hora_inicio) {
      return data.hora_fim > data.hora_inicio;
    }
    return true;
  },
  {
    message: "Horário de fim deve ser maior que o horário de início",
    path: ["hora_fim"],
  }
);

type FormData = z.infer<typeof formSchema>;

interface DailyServiceRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  recordId?: string;
}

export function DailyServiceRecordDialog({
  open,
  onOpenChange,
  onSuccess,
  recordId,
}: DailyServiceRecordDialogProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_id: "",
      asset_id: "",
      data_atendimento: new Date().toLocaleDateString('en-CA'), // Formato ISO usando timezone local
      hora_inicio: "",
      hora_fim: "",
      canal: "whatsapp",
      titulo: "",
      descricao: "",
      solucao: "",
      status: "em_andamento",
      observacoes: "",
    },
  });

  useEffect(() => {
    if (open) {
      loadCompanies();
      if (recordId) {
        loadRecord();
      }
    }
  }, [open, recordId]);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, nome_fantasia")
        .eq("status", true)
        .order("nome_fantasia");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  };

  const loadAssets = async (companyId: string) => {
    if (!companyId) {
      setAssets([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("assets")
        .select("id, nome, tipo, tag_patrimonial")
        .eq("company_id", companyId)
        .order("nome");

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error("Error loading assets:", error);
      setAssets([]);
    }
  };

  const loadRecord = async () => {
    if (!recordId) return;

    try {
      const { data, error } = await supabase
        .from("daily_service_records")
        .select("*")
        .eq("id", recordId)
        .single();

      if (error) throw error;

      if (data) {
        form.reset({
          company_id: data.company_id,
          asset_id: data.asset_id || "",
          data_atendimento: data.data_atendimento,
          hora_inicio: data.hora_inicio,
          hora_fim: data.hora_fim || "",
          canal: data.canal as "whatsapp" | "ligacao" | "visita_tecnica",
          titulo: data.titulo,
          descricao: data.descricao,
          solucao: data.solucao || "",
          status: data.status as "em_andamento" | "concluido" | "pendente",
          observacoes: data.observacoes || "",
        });
        
        // Carregar ativos da empresa
        loadAssets(data.company_id);
        
        // Carregar fotos existentes
        if (data.fotos && Array.isArray(data.fotos)) {
          setUploadedImages(data.fotos as unknown as UploadedImage[]);
        }
      }
    } catch (error) {
      console.error("Error loading record:", error);
      toast.error("Erro ao carregar registro");
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!profile) return;

    try {
      setLoading(true);

      const payload: any = {
        company_id: data.company_id,
        asset_id: data.asset_id,
        data_atendimento: data.data_atendimento,
        hora_inicio: data.hora_inicio,
        canal: data.canal,
        titulo: data.titulo,
        descricao: data.descricao,
        status: data.status,
        tecnico_id: profile.id,
        hora_fim: data.hora_fim || null,
        solucao: data.solucao || null,
        observacoes: data.observacoes || null,
        fotos: uploadedImages,
      };

      if (recordId) {
        const { error } = await supabase
          .from("daily_service_records")
          .update(payload)
          .eq("id", recordId);

        if (error) throw error;
        toast.success("Atendimento atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("daily_service_records")
          .insert([payload]);

        if (error) throw error;
        toast.success("Atendimento registrado com sucesso!");
      }

      onOpenChange(false);
      form.reset();
      setUploadedImages([]);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error saving record:", error);
      toast.error(error.message || "Erro ao salvar atendimento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {recordId ? "Editar Atendimento" : "Novo Atendimento Diário"}
          </DialogTitle>
          <DialogDescription>
            Registre os detalhes do atendimento realizado
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa *</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      loadAssets(value);
                      form.setValue("asset_id", "");
                    }} 
                    value={field.value}
                  >
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
              name="asset_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ativo/Equipamento *</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!form.watch("company_id")}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !form.watch("company_id")
                            ? "Selecione uma empresa primeiro"
                            : assets.length === 0
                              ? "Nenhum ativo disponível"
                              : "Selecione o ativo"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_atendimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do Atendimento *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} max={new Date().toLocaleDateString('en-CA')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="hora_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário de Início *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hora_fim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário de Fim</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="canal"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Canal de Atendimento *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="whatsapp" />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-green-600" />
                          WhatsApp
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="ligacao" />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center gap-2">
                          <Phone className="h-4 w-4 text-blue-600" />
                          Ligação
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="visita_tecnica" />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-orange-600" />
                          Visita Técnica
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Suporte instalação impressora" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Atendimento *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o atendimento realizado..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Mínimo de 20 caracteres ({field.value?.length || 0}/20)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="solucao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Solução Aplicada</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva a solução aplicada..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            <ImageUpload
              bucketName="daily-service-photos"
              maxImages={5}
              onImagesChange={setUploadedImages}
              existingImages={uploadedImages}
              disabled={loading}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações Adicionais</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações, anotações ou informações adicionais..."
                      className="min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              {recordId && form.watch('status') === 'concluido' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const { data, error } = await supabase
                        .from('daily_service_records')
                        .select(`
                          *,
                          companies (nome_fantasia),
                          profiles (nome),
                          assets (tag_patrimonial, tipo)
                        `)
                        .eq('id', recordId)
                        .single();
                      
                      if (error) throw error;
                      if (data) {
                        await exportSingleDailyServiceToPDF(data as any);
                        toast.success("PDF gerado com sucesso!");
                      }
                    } catch (error) {
                      console.error("Error generating PDF:", error);
                      toast.error("Erro ao gerar PDF");
                    }
                  }}
                  disabled={loading}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              )}
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
                {recordId ? "Atualizar" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
