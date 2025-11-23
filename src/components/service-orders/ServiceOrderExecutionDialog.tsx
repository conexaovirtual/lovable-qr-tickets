import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { UploadedImage } from "@/lib/imageUtils";

interface ServiceOrderExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOrder: any;
  onSuccess?: () => void;
}

const executionSchema = z.object({
  data_execucao: z.string().min(1, "Data é obrigatória"),
  descricao_servicos: z.string().min(20, "Descrição deve ter no mínimo 20 caracteres"),
  tempo_gasto_horas: z.number().min(0.25, "Tempo mínimo é 0.25h (15 min)").max(24, "Tempo máximo é 24h"),
  custo_pecas: z.number().min(0, "Custo não pode ser negativo").optional(),
  observacoes_execucao: z.string().optional(),
  finalizar: z.boolean().default(false),
});

type ExecutionFormData = z.infer<typeof executionSchema>;

export function ServiceOrderExecutionDialog({
  open,
  onOpenChange,
  serviceOrder,
  onSuccess,
}: ServiceOrderExecutionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const { toast } = useToast();

  const form = useForm<ExecutionFormData>({
    resolver: zodResolver(executionSchema),
    defaultValues: {
      data_execucao: new Date().toISOString().split('T')[0],
      descricao_servicos: serviceOrder?.descricao_servicos || "",
      tempo_gasto_horas: 1,
      custo_pecas: 0,
      observacoes_execucao: "",
      finalizar: false,
    },
  });

  // Carregar fotos existentes se houver
  useEffect(() => {
    if (serviceOrder?.fotos && Array.isArray(serviceOrder.fotos)) {
      setUploadedImages(serviceOrder.fotos as UploadedImage[]);
    }
  }, [serviceOrder]);

  const onSubmit = async (data: ExecutionFormData) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Valor padrão da hora do técnico (pode ser configurável futuramente)
      const valorHoraTecnico = 80;
      const custoTotal = (data.tempo_gasto_horas * valorHoraTecnico) + (data.custo_pecas || 0);
      const novoStatus = data.finalizar ? "finalizada" : "executada";

      const updateData: any = {
        data_execucao: data.data_execucao,
        descricao_servicos: data.descricao_servicos,
        tempo_gasto_horas: data.tempo_gasto_horas,
        custo_pecas: data.custo_pecas || 0,
        custo_total: custoTotal,
        status: novoStatus,
        fotos: uploadedImages,
        updated_at: new Date().toISOString(),
      };

      // Se há observações de execução, adiciona ao campo observacoes
      if (data.observacoes_execucao) {
        const observacoesAtuais = serviceOrder.observacoes || "";
        updateData.observacoes = observacoesAtuais 
          ? `${observacoesAtuais}\n\n--- Execução ---\n${data.observacoes_execucao}`
          : `--- Execução ---\n${data.observacoes_execucao}`;
      }

      const { error: updateError } = await supabase
        .from("service_orders")
        .update(updateData)
        .eq("id", serviceOrder.id);

      if (updateError) throw updateError;

      // Registrar no histórico
      await supabase.from("service_order_history").insert({
        service_order_id: serviceOrder.id,
        changed_by: user.id,
        campo_alterado: "execucao",
        valor_anterior: "-",
        valor_novo: `Tempo: ${data.tempo_gasto_horas}h | Peças: R$ ${(data.custo_pecas || 0).toFixed(2)} | Total: R$ ${custoTotal.toFixed(2)} | Fotos: ${uploadedImages.length}`,
        observacao: data.observacoes_execucao,
      });

      toast({
        title: "Execução registrada!",
        description: `OS #${serviceOrder.numero_os} ${data.finalizar ? "finalizada" : "marcada como executada"}.`,
      });

      onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao registrar execução:", error);
      toast({
        title: "Erro ao registrar execução",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Execução</DialogTitle>
          <DialogDescription>
            OS #{serviceOrder?.numero_os}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="data_execucao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Execução</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} max={new Date().toISOString().split('T')[0]} />
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
                  <FormLabel>Serviço Realizado *</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      rows={5}
                      placeholder="Descreva detalhadamente o serviço realizado..." 
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
              name="tempo_gasto_horas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tempo Gasto (horas)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.25" 
                      min="0.25" 
                      max="24"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Mínimo: 0.25h (15 min) | Máximo: 24h</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="custo_pecas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custo de Peças (R$)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>Deixe em 0 se não houver custo de peças</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Fotos do Atendimento</label>
              <ImageUpload
                bucketName="service-order-photos"
                maxImages={5}
                onImagesChange={setUploadedImages}
                existingImages={uploadedImages}
                disabled={loading}
              />
            </div>

            <FormField
              control={form.control}
              name="observacoes_execucao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações da Execução</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Descreva o que foi realizado..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="finalizar"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Finalizar Ordem de Serviço</FormLabel>
                    <FormDescription>
                      Marque para finalizar a OS. Se não marcar, ficará como "Executada".
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Preview do Custo Total */}
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium">Custo Total Estimado</p>
              <p className="text-2xl font-bold">
                R$ {((form.watch("tempo_gasto_horas") * 80) + (form.watch("custo_pecas") || 0)).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Mão de obra (R$ 80/h) + Peças
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Registrando..." : "Registrar Execução"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
