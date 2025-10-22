import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, XCircle, PlayCircle, FileText, Clock, Calendar } from "lucide-react";
import { generateServiceOrderPDF } from "./ServiceOrderPDF";

interface ServiceOrderDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOrder: any;
  onUpdate?: () => void;
}

const statusColors: Record<string, string> = {
  agendada: "bg-blue-500",
  confirmada: "bg-green-500",
  em_execucao: "bg-yellow-500",
  executada: "bg-purple-500",
  finalizada: "bg-gray-700",
  cancelada: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  em_execucao: "Em Execução",
  executada: "Executada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export function ServiceOrderDetailDialog({
  open,
  onOpenChange,
  serviceOrder,
  onUpdate,
}: ServiceOrderDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open && serviceOrder) {
      loadHistory();
    }
  }, [open, serviceOrder]);

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from("service_order_history")
      .select(`
        *,
        profiles (nome)
      `)
      .eq("service_order_id", serviceOrder.id)
      .order("created_at", { ascending: false });

    if (!error) {
      setHistory(data || []);
    }
  };

  const updateStatus = async (newStatus: string, observacao?: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error: updateError } = await supabase
        .from("service_orders")
        .update({ status: newStatus })
        .eq("id", serviceOrder.id);

      if (updateError) throw updateError;

      await supabase.from("service_order_history").insert({
        service_order_id: serviceOrder.id,
        changed_by: user.id,
        campo_alterado: "status",
        valor_anterior: serviceOrder.status,
        valor_novo: newStatus,
        observacao,
      });

      toast({
        title: "Status atualizado!",
        description: `OS #${serviceOrder.numero_os} agora está ${statusLabels[newStatus]}`,
      });

      onUpdate?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = () => {
    generateServiceOrderPDF(serviceOrder);
  };

  if (!serviceOrder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Ordem de Serviço #{serviceOrder.numero_os}</DialogTitle>
            <Badge className={statusColors[serviceOrder.status]}>
              {statusLabels[serviceOrder.status]}
            </Badge>
          </div>
          <DialogDescription>
            Criada em {format(new Date(serviceOrder.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações Básicas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground">Empresa</h4>
              <p>{serviceOrder.companies?.nome_fantasia}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground">Tipo de Serviço</h4>
              <p className="capitalize">{serviceOrder.tipo_servico}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground">Prioridade</h4>
              <p className="capitalize">{serviceOrder.prioridade}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground">Técnico</h4>
              <p>{serviceOrder.profiles?.nome || "Não atribuído"}</p>
            </div>
          </div>

          <Separator />

          {/* Agendamento */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Agendamento</h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{serviceOrder.data_agendada && format(new Date(serviceOrder.data_agendada), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{serviceOrder.hora_agendada?.slice(0, 5)}</span>
              </div>
              {serviceOrder.tempo_estimado_horas && (
                <span className="text-sm text-muted-foreground">
                  ({serviceOrder.tempo_estimado_horas}h estimadas)
                </span>
              )}
            </div>
          </div>

          <Separator />

          {/* Descrição */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Descrição do Serviço</h4>
            <p className="text-sm whitespace-pre-wrap">{serviceOrder.descricao_servicos}</p>
          </div>

          {/* Localização */}
          {serviceOrder.endereco_atendimento && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Localização</h4>
                <p className="text-sm">{serviceOrder.endereco_atendimento}</p>
                {serviceOrder.contato_local && (
                  <p className="text-sm mt-1">Contato: {serviceOrder.contato_local} {serviceOrder.telefone_contato && `- ${serviceOrder.telefone_contato}`}</p>
                )}
              </div>
            </>
          )}

          {/* Observações */}
          {serviceOrder.observacoes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Observações</h4>
                <p className="text-sm whitespace-pre-wrap">{serviceOrder.observacoes}</p>
              </div>
            </>
          )}

          {/* Histórico */}
          {history.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Histórico de Alterações</h4>
                <div className="space-y-2">
                  {history.map(item => (
                    <div key={item.id} className="text-sm border-l-2 border-primary pl-3 py-1">
                      <p className="font-medium">
                        {item.campo_alterado}: {item.valor_anterior || "—"} → {item.valor_novo}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {item.profiles?.nome} • {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                      {item.observacao && <p className="text-xs mt-1">{item.observacao}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Ações */}
          <div className="flex flex-wrap gap-2">
            {serviceOrder.status === "agendada" && (
              <>
                <Button
                  onClick={() => updateStatus("confirmada", "OS confirmada pelo técnico")}
                  disabled={loading}
                  size="sm"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar
                </Button>
                <Button
                  onClick={() => updateStatus("cancelada", "OS cancelada")}
                  disabled={loading}
                  variant="destructive"
                  size="sm"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </>
            )}

            {serviceOrder.status === "confirmada" && (
              <Button
                onClick={() => updateStatus("em_execucao", "Atendimento iniciado")}
                disabled={loading}
                size="sm"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Iniciar Atendimento
              </Button>
            )}

            {(serviceOrder.status === "executada" || serviceOrder.status === "finalizada") && (
              <Button
                onClick={handleGeneratePDF}
                variant="outline"
                size="sm"
              >
                <FileText className="h-4 w-4 mr-2" />
                Baixar PDF
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}