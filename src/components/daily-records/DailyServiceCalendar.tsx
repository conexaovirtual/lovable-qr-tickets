import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DailyServiceCalendarProps {
  refreshTrigger?: number;
}

export function DailyServiceCalendar({ refreshTrigger }: DailyServiceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [records, setRecords] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedTechnician, setSelectedTechnician] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const { toast } = useToast();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  useEffect(() => {
    loadData();
  }, [currentDate, selectedCompany, selectedTechnician, selectedStatus, selectedChannel, refreshTrigger]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadRecords(), loadCompanies(), loadTechnicians()]);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async () => {
    let query = supabase
      .from("daily_service_records")
      .select(`
        *,
        companies:company_id (nome_fantasia),
        profiles:tecnico_id (nome)
      `)
      .gte("data_atendimento", format(monthStart, "yyyy-MM-dd"))
      .lte("data_atendimento", format(monthEnd, "yyyy-MM-dd"))
      .order("data_atendimento", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (selectedCompany !== "all") {
      query = query.eq("company_id", selectedCompany);
    }
    if (selectedTechnician !== "all") {
      query = query.eq("tecnico_id", selectedTechnician);
    }
    if (selectedStatus !== "all") {
      query = query.eq("status", selectedStatus);
    }
    if (selectedChannel !== "all") {
      query = query.eq("canal", selectedChannel as "whatsapp" | "ligacao" | "visita_tecnica");
    }

    const { data, error } = await query;

    if (error) throw error;
    setRecords(data || []);
  };

  const loadCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("id, nome_fantasia")
      .eq("status", true)
      .order("nome_fantasia");

    if (error) throw error;
    setCompanies(data || []);
  };

  const loadTechnicians = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome")
      .order("nome");

    if (error) throw error;
    setTechnicians(data || []);
  };

  const getRecordsForDay = (day: Date) => {
    return records.filter((record) => {
      const recordDate = parseISO(record.data_atendimento);
      return isSameDay(recordDate, day);
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concluido":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
      case "em_andamento":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
      case "pendente":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "concluido": return "Concluído";
      case "em_andamento": return "Em Andamento";
      case "pendente": return "Pendente";
      default: return status;
    }
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Agenda de Atendimentos
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={previousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Hoje
              </Button>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="font-semibold ml-2">
                {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Empresas</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.nome_fantasia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por técnico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Técnicos</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Canais</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="ligacao">Ligação</SelectItem>
                <SelectItem value="visita_tecnica">Visita Técnica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <div key={day} className="text-center font-semibold text-sm p-2 text-muted-foreground">
                  {day}
                </div>
              ))}
              
              {monthDays.map((day, idx) => {
                const dayRecords = getRecordsForDay(day);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div
                    key={idx}
                    className={cn(
                      "min-h-[120px] p-2 border rounded-lg",
                      !isSameMonth(day, currentDate) && "opacity-40",
                      isToday && "border-primary border-2 bg-primary/5"
                    )}
                  >
                    <div className={cn(
                      "text-sm font-medium mb-1",
                      isToday && "text-primary font-bold"
                    )}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayRecords.slice(0, 3).map((record) => (
                        <div
                          key={record.id}
                          className={cn(
                            "text-xs p-1 rounded border cursor-pointer hover:opacity-80 transition-opacity",
                            getStatusColor(record.status)
                          )}
                          title={`${record.titulo} - ${record.companies?.nome_fantasia}\n${record.hora_inicio}`}
                        >
                          <div className="font-medium truncate">{record.hora_inicio}</div>
                          <div className="truncate">{record.titulo}</div>
                        </div>
                      ))}
                      {dayRecords.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayRecords.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor("concluido")}>
                {getStatusLabel("concluido")}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor("em_andamento")}>
                {getStatusLabel("em_andamento")}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor("pendente")}>
                {getStatusLabel("pendente")}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
