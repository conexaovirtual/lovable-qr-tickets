import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VisitPlan } from '@/hooks/useVisitSchedule';
import { formatDateBR } from '@/lib/formatters';
import { 
  Calendar, 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  Sparkles,
  Save
} from 'lucide-react';

interface VisitPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: VisitPlan[];
  summary: string | null;
  onSave: (selectedVisits: VisitPlan[]) => Promise<boolean>;
  loading: boolean;
}

export function VisitPlanModal({
  open,
  onOpenChange,
  plan,
  summary,
  onSave,
  loading,
}: VisitPlanModalProps) {
  const [selectedVisits, setSelectedVisits] = useState<Set<string>>(
    new Set(plan.map((v) => v.company_id))
  );

  const toggleVisit = (companyId: string) => {
    const newSelected = new Set(selectedVisits);
    if (newSelected.has(companyId)) {
      newSelected.delete(companyId);
    } else {
      newSelected.add(companyId);
    }
    setSelectedVisits(newSelected);
  };

  const selectAll = () => {
    setSelectedVisits(new Set(plan.map((v) => v.company_id)));
  };

  const deselectAll = () => {
    setSelectedVisits(new Set());
  };

  const handleSave = async () => {
    const visitsToSave = plan.filter((v) => selectedVisits.has(v.company_id));
    const success = await onSave(visitsToSave);
    if (success) {
      onOpenChange(false);
    }
  };

  const getPriorityVariant = (prioridade: string): 'destructive' | 'default' | 'secondary' | 'outline' => {
    switch (prioridade) {
      case 'alta':
        return 'destructive';
      case 'media':
        return 'default';
      case 'baixa':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getFrequencyLabel = (frequencia: string) => {
    switch (frequencia) {
      case 'semanal':
        return 'Semanal';
      case 'quinzenal':
        return 'Quinzenal';
      case 'mensal':
        return 'Mensal';
      case 'trimestral':
        return 'Trimestral';
      default:
        return frequencia;
    }
  };

  const getMotivoIcon = (motivo: string) => {
    switch (motivo) {
      case 'preventiva':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'corretiva':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'acompanhamento':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Plano de Visitas Gerado pela IA
          </DialogTitle>
          <DialogDescription>
            Revise as sugestões da IA e selecione as visitas que deseja agendar.
          </DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Resumo da IA:</p>
            {summary}
          </div>
        )}

        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">
            {selectedVisits.size} de {plan.length} visitas selecionadas
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Selecionar Todas
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Limpar Seleção
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {plan.map((visit) => (
              <div
                key={visit.company_id}
                className={`border rounded-lg p-4 transition-colors ${
                  selectedVisits.has(visit.company_id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedVisits.has(visit.company_id)}
                    onCheckedChange={() => toggleVisit(visit.company_id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{visit.company_name}</span>
                      <Badge variant={getPriorityVariant(visit.prioridade)}>
                        {visit.prioridade.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        {getMotivoIcon(visit.motivo)}
                        {visit.motivo}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateBR(visit.proxima_visita)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getFrequencyLabel(visit.frequencia)}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground bg-muted/30 rounded p-2">
                      <Sparkles className="h-3 w-3 inline mr-1" />
                      {visit.justificativa_ia}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={selectedVisits.size === 0 || loading}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Salvando...' : `Salvar ${selectedVisits.size} Visitas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
