import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ServiceOrderDetailDialog } from "./ServiceOrderDetailDialog";

const statusColors = {
  agendada: "bg-blue-500",
  confirmada: "bg-green-500",
  em_execucao: "bg-yellow-500",
  executada: "bg-purple-500",
  finalizada: "bg-gray-500",
  cancelada: "bg-red-500",
};

const statusLabels = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  em_execucao: "Em Execução",
  executada: "Executada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export function ServiceOrderCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("all");
  const [selectedOS, setSelectedOS] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    loadTechnicians();
  }, []);

  useEffect(() => {
    loadServiceOrders();
  }, [currentMonth, selectedTechnicianId]);

  const loadTechnicians = async () => {
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "tecnico");

    if (rolesData) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", rolesData.map(r => r.user_id));

      setTechnicians(profilesData || []);
    }
  };

  const loadServiceOrders = async () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    let query = supabase
      .from("service_orders")
      .select(`
        *,
        companies (nome_fantasia),
        profiles!service_orders_tecnico_id_fkey (nome)
      `)
      .gte("data_agendada", start.toISOString())
      .lte("data_agendada", end.toISOString())
      .order("data_agendada", { ascending: true });

    if (selectedTechnicianId !== "all") {
      query = query.eq("tecnico_id", selectedTechnicianId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao carregar OSs:", error);
      return;
    }

    setServiceOrders(data || []);
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getOSsForDay = (day: Date) => {
    return serviceOrders.filter(os => {
      const osDate = new Date(os.data_agendada);
      return isSameDay(osDate, day);
    });
  };

  const handleOSClick = (os: any) => {
    setSelectedOS(os);
    setDetailDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Calendário de Ordens de Serviço</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por técnico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os técnicos</SelectItem>
                  {technicians.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
              <div key={day} className="text-center text-sm font-semibold p-2">
                {day}
              </div>
            ))}

            {/* Espaços vazios antes do primeiro dia */}
            {Array.from({ length: days[0].getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] border rounded-lg bg-muted/30" />
            ))}

            {days.map(day => {
              const dayOSs = getOSsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[100px] border rounded-lg p-2 ${
                    isCurrentMonth ? "bg-background" : "bg-muted/30"
                  }`}
                >
                  <div className="text-sm font-medium mb-1">
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayOSs.slice(0, 3).map(os => (
                      <button
                        key={os.id}
                        onClick={() => handleOSClick(os)}
                        className="w-full text-left"
                      >
                        <div
                          className={`text-xs px-2 py-1 rounded ${statusColors[os.status as keyof typeof statusColors]} text-white truncate`}
                        >
                          #{os.numero_os} - {os.hora_agendada?.slice(0, 5)}
                        </div>
                      </button>
                    ))}
                    {dayOSs.length > 3 && (
                      <div className="text-xs text-muted-foreground px-2">
                        +{dayOSs.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(statusLabels).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${statusColors[key as keyof typeof statusColors]}`} />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedOS && (
        <ServiceOrderDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          serviceOrder={selectedOS}
          onUpdate={loadServiceOrders}
        />
      )}
    </>
  );
}