import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DailyServiceRecordCard } from "./DailyServiceRecordCard";
import { DailyServiceRecordDialog } from "./DailyServiceRecordDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, X, FileDown } from "lucide-react";
import { toast } from "sonner";
import { exportDailyServicesToPDF } from "@/lib/exportDailyServices";

interface DailyServiceRecordListProps {
  onUpdate?: () => void;
}

export function DailyServiceRecordList({ onUpdate }: DailyServiceRecordListProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCanal, setFilterCanal] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [companies, setCompanies] = useState<any[]>([]);
  const [editingRecord, setEditingRecord] = useState<string | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadCompanies();
    loadRecords();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [filterCanal, filterStatus, filterCompany, search, dataInicio, dataFim]);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, nome_fantasia")
        .eq("status", true)
        .order("nome_fantasia");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("daily_service_records")
        .select(`
          *,
          companies (nome_fantasia),
          profiles (nome)
        `)
        .order("data_atendimento", { ascending: false })
        .order("hora_inicio", { ascending: false });

      if (filterCanal && filterCanal !== "all") {
        query = query.eq("canal", filterCanal as "whatsapp" | "ligacao" | "visita_tecnica");
      }

      if (filterStatus && filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      if (filterCompany && filterCompany !== "all") {
        query = query.eq("company_id", filterCompany);
      }

      if (dataInicio) {
        query = query.gte("data_atendimento", dataInicio);
      }

      if (dataFim) {
        query = query.lte("data_atendimento", dataFim);
      }

      if (search) {
        query = query.or(`titulo.ilike.%${search}%,descricao.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecords(data || []);
    } catch (error: any) {
      console.error("Error loading records:", error);
      toast.error("Erro ao carregar atendimentos");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: any) => {
    setEditingRecord(record.id);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingRecord(undefined);
  };

  const handleSuccess = () => {
    loadRecords();
    onUpdate?.();
  };

  const clearFilters = () => {
    setSearch("");
    setFilterCanal("all");
    setFilterStatus("all");
    setFilterCompany("all");
    setDataInicio("");
    setDataFim("");
  };

  const handleExportFiltered = async () => {
    if (records.length === 0) {
      toast.error("Nenhum atendimento para exportar");
      return;
    }

    try {
      const stats = {
        total: records.length,
        whatsapp: records.filter(r => r.canal === 'whatsapp').length,
        ligacao: records.filter(r => r.canal === 'ligacao').length,
        visita_tecnica: records.filter(r => r.canal === 'visita_tecnica').length,
        concluidos: records.filter(r => r.status === 'concluido').length,
        em_andamento: records.filter(r => r.status === 'em_andamento').length,
        pendentes: records.filter(r => r.status === 'pendente').length,
        tempo_medio: 0
      };

      await exportDailyServicesToPDF(records, stats, { dataInicio, dataFim });
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  const hasActiveFilters = search || (filterCanal !== "all") || (filterStatus !== "all") || (filterCompany !== "all") || dataInicio || dataFim;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atendimentos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterCanal} onValueChange={setFilterCanal}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os canais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="ligacao">Ligação</SelectItem>
                <SelectItem value="visita_tecnica">Visita Técnica</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.nome_fantasia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div>
              <Input
                type="date"
                placeholder="Data início"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div>
              <Input
                type="date"
                placeholder="Data fim"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {records.length} atendimento(s) encontrado(s)
              </p>
              <div className="flex gap-2">
                {records.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleExportFiltered}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Exportar Período (PDF)
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar filtros
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Registros */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-3/4 mb-4" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum atendimento encontrado</h3>
            <p className="text-muted-foreground">
              {hasActiveFilters
                ? "Tente ajustar os filtros para encontrar outros atendimentos."
                : "Ainda não há atendimentos registrados."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map((record) => (
            <DailyServiceRecordCard
              key={record.id}
              record={record}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      <DailyServiceRecordDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        onSuccess={handleSuccess}
        recordId={editingRecord}
      />
    </div>
  );
}
