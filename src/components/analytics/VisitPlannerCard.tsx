import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CompanyHealth } from '@/hooks/useAnalyticsData';
import { useVisitSchedule } from '@/hooks/useVisitSchedule';
import { VisitPlanModal } from './VisitPlanModal';
import { 
  Sparkles, 
  Calendar, 
  MapPin, 
  Loader2,
  AlertCircle
} from 'lucide-react';

interface VisitPlannerCardProps {
  neglectedCompanies: CompanyHealth[];
}

export function VisitPlannerCard({ neglectedCompanies }: VisitPlannerCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const {
    loading,
    generatedPlan,
    planSummary,
    generateVisitPlan,
    saveVisitPlan,
    clearPlan,
  } = useVisitSchedule();

  const handleGeneratePlan = async () => {
    if (neglectedCompanies.length === 0) return;
    
    try {
      await generateVisitPlan(neglectedCompanies);
      setModalOpen(true);
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  const handleSave = async (visits: typeof generatedPlan, options?: { createServiceOrders?: boolean }) => {
    if (!visits) return { success: false };
    return await saveVisitPlan(visits, options);
  };

  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      clearPlan();
    }
  };

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Planejador de Visitas IA</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Gere um mapa de visitas inteligente
                </p>
              </div>
            </div>
            {neglectedCompanies.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {neglectedCompanies.length} empresas
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {neglectedCompanies.length === 0 ? (
            <div className="text-center py-4">
              <MapPin className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Todas as empresas estão em dia!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-background rounded-lg p-3">
                  <p className="text-2xl font-bold text-destructive">
                    {neglectedCompanies.filter(c => c.dias_sem_visita === 999).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Nunca visitadas</p>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <p className="text-2xl font-bold text-amber-500">
                    {neglectedCompanies.filter(c => c.dias_sem_visita !== 999).length}
                  </p>
                  <p className="text-xs text-muted-foreground">{'>'}30 dias</p>
                </div>
              </div>

              <Button
                onClick={handleGeneratePlan}
                disabled={loading}
                className="w-full gap-2"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando plano com IA...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4" />
                    Gerar Mapa de Visitas
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                A IA analisará apenas <strong>clientes de contrato</strong> e sugerirá datas e frequências ideais para visitas preventivas obrigatórias
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {generatedPlan && (
        <VisitPlanModal
          open={modalOpen}
          onOpenChange={handleModalClose}
          plan={generatedPlan}
          summary={planSummary}
          onSave={handleSave}
          loading={loading}
        />
      )}
    </>
  );
}
