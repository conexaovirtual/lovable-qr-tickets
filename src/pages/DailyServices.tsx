import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DailyServiceRecordDialog } from "@/components/daily-records/DailyServiceRecordDialog";
import { DailyServiceRecordList } from "@/components/daily-records/DailyServiceRecordList";
import { DailyServicesReport } from "@/components/reports/DailyServicesReport";
import { Plus, ClipboardList, MessageCircle, Phone, MapPin } from "lucide-react";
import { format } from "date-fns";

export default function DailyServices() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    total_hoje: 0,
    whatsapp: 0,
    ligacao: 0,
    visita_tecnica: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/auth");
    }
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (profile) {
      loadStats();
    }
  }, [profile]);

  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const today = format(new Date(), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("daily_service_records")
        .select("canal")
        .eq("data_atendimento", today);

      if (error) throw error;

      const stats = {
        total_hoje: data?.length || 0,
        whatsapp: data?.filter((r) => r.canal === "whatsapp").length || 0,
        ligacao: data?.filter((r) => r.canal === "ligacao").length || 0,
        visita_tecnica: data?.filter((r) => r.canal === "visita_tecnica").length || 0,
      };

      setStats(stats);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  if (loading || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Atendimentos Diários</h1>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Atendimento
          </Button>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hoje</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_hoje}</div>
              <p className="text-xs text-muted-foreground">Atendimentos registrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">WhatsApp</CardTitle>
              <MessageCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.whatsapp}</div>
              <p className="text-xs text-muted-foreground">Via mensagem</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ligações</CardTitle>
              <Phone className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.ligacao}</div>
              <p className="text-xs text-muted-foreground">Por telefone</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Visitas</CardTitle>
              <MapPin className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.visita_tecnica}</div>
              <p className="text-xs text-muted-foreground">Visitas técnicas</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="atendimentos" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
            <TabsTrigger value="calendario">Calendário</TabsTrigger>
          </TabsList>

          <TabsContent value="atendimentos" className="mt-6">
            <DailyServiceRecordList onUpdate={loadStats} />
          </TabsContent>

          <TabsContent value="relatorios" className="mt-6">
            <DailyServicesReport />
          </TabsContent>

          <TabsContent value="calendario" className="mt-6">
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Visualização de calendário em desenvolvimento</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DailyServiceRecordDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSuccess={loadStats}
        />
      </main>
    </div>
  );
}
