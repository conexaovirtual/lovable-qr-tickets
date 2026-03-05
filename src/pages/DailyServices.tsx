import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DailyServicesReport } from "@/components/reports/DailyServicesReport";
import { DailyServiceRecordDialog } from "@/components/daily-records/DailyServiceRecordDialog";
import { DailyServiceRecordList } from "@/components/daily-records/DailyServiceRecordList";
import { DailyServiceCalendar } from "@/components/daily-records/DailyServiceCalendar";
import { Plus, BarChart3, List, Calendar } from "lucide-react";

export default function DailyServices() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Verificar se há um recordId na URL para abrir o dialog automaticamente
  useEffect(() => {
    const recordId = searchParams.get('recordId');
    if (recordId) {
      setEditingRecordId(recordId);
      // Limpar o parâmetro da URL
      window.history.replaceState({}, '', '/daily-services');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/auth");
    }
  }, [profile, loading, navigate]);

  if (loading || !profile) {
    return null;
  }

  return (
    <div className="bg-background">
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Relatório de Atendimentos</h1>
            <p className="text-muted-foreground mt-1">
              Visualize métricas e estatísticas dos atendimentos realizados
            </p>
          </div>
          <Button onClick={() => setRecordDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Atendimento
          </Button>
        </div>

        <Tabs defaultValue="atendimentos" className="w-full">
          <TabsList>
            <TabsTrigger value="atendimentos">
              <List className="h-4 w-4 mr-2" />
              Atendimentos
            </TabsTrigger>
            <TabsTrigger value="agenda">
              <Calendar className="h-4 w-4 mr-2" />
              Agenda
            </TabsTrigger>
            <TabsTrigger value="relatorios">
              <BarChart3 className="h-4 w-4 mr-2" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="atendimentos" className="mt-6">
            <DailyServiceRecordList 
              onUpdate={() => setRefreshTrigger(prev => prev + 1)} 
            />
          </TabsContent>

          <TabsContent value="agenda" className="mt-6">
            <DailyServiceCalendar refreshTrigger={refreshTrigger} />
          </TabsContent>

          <TabsContent value="relatorios" className="mt-6">
            <DailyServicesReport />
          </TabsContent>
        </Tabs>

        <DailyServiceRecordDialog
          open={recordDialogOpen || !!editingRecordId}
          onOpenChange={(open) => {
            setRecordDialogOpen(open);
            if (!open) setEditingRecordId(null);
          }}
          recordId={editingRecordId || undefined}
          onSuccess={() => {
            setRefreshTrigger(prev => prev + 1);
            setRecordDialogOpen(false);
            setEditingRecordId(null);
          }}
        />
      </main>
    </div>
  );
}
