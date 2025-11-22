import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickTicketDialog } from "@/components/tickets/QuickTicketDialog";
import { DailyServicesReport } from "@/components/reports/DailyServicesReport";
import { Plus, BarChart3 } from "lucide-react";

export default function DailyServices() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/auth");
    }
  }, [profile, loading, navigate]);

  if (loading || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Relatório de Atendimentos</h1>
            <p className="text-muted-foreground mt-1">
              Visualize métricas e estatísticas dos atendimentos realizados
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Registro Rápido
          </Button>
        </div>

        <Tabs defaultValue="relatorios" className="w-full">
          <TabsList>
            <TabsTrigger value="relatorios">
              <BarChart3 className="h-4 w-4 mr-2" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="relatorios" className="mt-6">
            <DailyServicesReport />
          </TabsContent>
        </Tabs>

        <QuickTicketDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      </main>
    </div>
  );
}
