import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { FileDown, MessageCircle, Phone, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function DailyServicesReport() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    whatsapp: 0,
    ligacao: 0,
    visita_tecnica: 0,
    concluidos: 0,
    em_andamento: 0,
    pendentes: 0,
    tempo_medio: 0,
  });

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("daily_service_records")
        .select(`
          *,
          companies (nome_fantasia),
          profiles (nome)
        `)
        .order("data_atendimento", { ascending: false })
        .order("hora_inicio", { ascending: false });

      if (error) throw error;

      setRecords(data || []);
      calculateStats(data || []);
    } catch (error: any) {
      console.error("Error loading records:", error);
      toast.error("Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: any[]) => {
    const stats = {
      total: data.length,
      whatsapp: data.filter((r) => r.canal === "whatsapp").length,
      ligacao: data.filter((r) => r.canal === "ligacao").length,
      visita_tecnica: data.filter((r) => r.canal === "visita_tecnica").length,
      concluidos: data.filter((r) => r.status === "concluido").length,
      em_andamento: data.filter((r) => r.status === "em_andamento").length,
      pendentes: data.filter((r) => r.status === "pendente").length,
      tempo_medio: 0,
    };

    // Calcular tempo médio de atendimento
    const recordsWithTime = data.filter((r) => r.hora_inicio && r.hora_fim);
    if (recordsWithTime.length > 0) {
      const totalMinutes = recordsWithTime.reduce((acc, r) => {
        const [startH, startM] = r.hora_inicio.split(":").map(Number);
        const [endH, endM] = r.hora_fim.split(":").map(Number);
        const minutes = (endH * 60 + endM) - (startH * 60 + startM);
        return acc + minutes;
      }, 0);
      stats.tempo_medio = Math.round(totalMinutes / recordsWithTime.length);
    }

    setStats(stats);
  };

  const canalData = [
    { name: "WhatsApp", value: stats.whatsapp, color: "#25D366" },
    { name: "Ligação", value: stats.ligacao, color: "#3B82F6" },
    { name: "Visita Técnica", value: stats.visita_tecnica, color: "#F59E0B" },
  ];

  const statusData = [
    { name: "Concluídos", value: stats.concluidos },
    { name: "Em Andamento", value: stats.em_andamento },
    { name: "Pendentes", value: stats.pendentes },
  ];

  const handleExport = () => {
    toast.info("Exportação em desenvolvimento");
  };

  const getChannelBadge = (canal: string) => {
    const configs = {
      whatsapp: { icon: MessageCircle, label: "WhatsApp", className: "bg-green-100 text-green-800" },
      ligacao: { icon: Phone, label: "Ligação", className: "bg-blue-100 text-blue-800" },
      visita_tecnica: { icon: MapPin, label: "Visita", className: "bg-orange-100 text-orange-800" },
    };
    const config = configs[canal as keyof typeof configs] || configs.whatsapp;
    const Icon = config.icon;
    return (
      <Badge className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-3/4 mb-4" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Relatório de Atendimentos</h2>
        <Button onClick={handleExport}>
          <FileDown className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Atendimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.concluidos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.em_andamento}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tempo Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.floor(stats.tempo_medio / 60)}h {stats.tempo_medio % 60}m
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Atendimentos por Canal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={canalData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {canalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atendimentos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Atendimentos Detalhados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Horário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhum atendimento registrado
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {format(new Date(record.data_atendimento), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getChannelBadge(record.canal)}</TableCell>
                      <TableCell className="font-medium">{record.titulo}</TableCell>
                      <TableCell>{record.companies?.nome_fantasia}</TableCell>
                      <TableCell>{record.profiles?.nome}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            record.status === "concluido"
                              ? "default"
                              : record.status === "em_andamento"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {record.status === "concluido"
                            ? "Concluído"
                            : record.status === "em_andamento"
                            ? "Em Andamento"
                            : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.hora_inicio}
                        {record.hora_fim && ` - ${record.hora_fim}`}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
