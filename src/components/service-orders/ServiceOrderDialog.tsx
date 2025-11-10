import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { UploadedImage } from '@/lib/imageUtils';
import { generateServiceOrderPDF } from './ServiceOrderPDF';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  data_execucao: z.string().min(1, 'Data de execução é obrigatória'),
  descricao_servicos: z.string().min(20, 'Descrição deve ter no mínimo 20 caracteres'),
  tempo_gasto_horas: z.string().min(1, 'Tempo gasto é obrigatório'),
  custo_pecas: z.string(),
  observacoes: z.string().optional(),
});

interface ServiceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: any;
  onSuccess?: () => void;
}

export function ServiceOrderDialog({ open, onOpenChange, ticket, onSuccess }: ServiceOrderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      data_execucao: new Date().toISOString().split('T')[0],
      descricao_servicos: '',
      tempo_gasto_horas: ticket?.tempo_gasto_horas?.toString() || '0',
      custo_pecas: ticket?.custo_pecas?.toString() || '0',
      observacoes: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const tempo_gasto = parseFloat(values.tempo_gasto_horas);
      const custo_pecas = parseFloat(values.custo_pecas || '0');
      const custo_total = custo_pecas; // Pode adicionar cálculo de hora mais tarde

      // Criar OS (numero_os é gerado automaticamente pelo trigger)
      const { data: serviceOrder, error } = await supabase
        .from('service_orders')
        .insert([{
          ticket_id: ticket.id,
          company_id: ticket.company_id,
          tecnico_id: ticket.tecnico_id || user.id,
          data_execucao: new Date(values.data_execucao).toISOString(),
          descricao_servicos: values.descricao_servicos,
          tempo_gasto_horas: tempo_gasto,
          custo_pecas: custo_pecas,
          custo_total: custo_total,
          observacoes: values.observacoes || null,
          status: 'executada',
          numero_os: 0, // Will be overridden by trigger
          fotos: uploadedImages,
        } as any])
        .select(`
          *,
          tickets (numero, titulo),
          companies:companies_safe (nome_fantasia, cnpj, endereco),
          profiles:tecnico_id (nome)
        `)
        .single();

      if (error) throw error;

      // Gerar PDF (agora assíncrono com fotos)
      try {
        await generateServiceOrderPDF(serviceOrder);
        toast({
          title: 'OS Gerada com Sucesso',
          description: `OS #${serviceOrder.numero_os} foi criada e o PDF foi baixado.`,
        });
      } catch (pdfError) {
        console.error("Erro ao gerar PDF:", pdfError);
        toast({
          title: 'OS criada, mas erro ao gerar PDF',
          description: 'A ordem de serviço foi salva, mas houve um problema ao gerar o PDF.',
          variant: 'destructive',
        });
      }

      onSuccess?.();
      onOpenChange(false);
      form.reset();
      setUploadedImages([]);
    } catch (error: any) {
      console.error('Erro ao gerar OS:', error);
      toast({
        title: 'Erro ao Gerar OS',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar Ordem de Serviço</DialogTitle>
          <DialogDescription>
            Chamado #{ticket?.numero} - {ticket?.titulo}
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
                  <FormLabel>Descrição dos Serviços Realizados</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      rows={6}
                      placeholder="Descreva detalhadamente os serviços realizados..."
                    />
                  </FormControl>
                  <FormDescription>
                    Mínimo de 20 caracteres
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tempo_gasto_horas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tempo Gasto (horas)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" min="0" {...field} />
                    </FormControl>
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
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <ImageUpload
              bucketName="service-order-photos"
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
                  <FormLabel>Observações (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      rows={3}
                      placeholder="Recomendações, observações adicionais..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
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
                Gerar OS e PDF
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
