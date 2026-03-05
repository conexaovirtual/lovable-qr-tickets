import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, DollarSign, TrendingUp, TrendingDown, Wallet, Loader2, Building2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const categories = [
  "Mão de Obra", "Peças e Materiais", "Licenças de Software", "Hardware",
  "Deslocamento", "Consultoria", "Contrato Mensal", "Outros",
];

const CostCenter = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));
  const [form, setForm] = useState({
    company_id: "", category: "", description: "", amount: "", type: "despesa", reference_date: format(new Date(), "yyyy-MM-dd"),
  });

  const isAdmin = profile?.roles?.includes("admin_provedor");

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-cc"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, nome_fantasia").eq("status", true).order("nome_fantasia");
      return data || [];
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["cost-centers", filterCompany, filterMonth],
    queryFn: async () => {
      let query = supabase.from("cost_centers").select("*").order("reference_date", { ascending: false });
      if (filterCompany !== "all") query = query.eq("company_id", filterCompany);
      if (filterMonth) {
        const start = `${filterMonth}-01`;
        const endDate = new Date(parseInt(filterMonth.split("-")[0]), parseInt(filterMonth.split("-")[1]), 0);
        const end = format(endDate, "yyyy-MM-dd");
        query = query.gte("reference_date", start).lte("reference_date", end);
      }
      const { data } = await query;
      return data || [];
    },
  });

  const createEntry = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cost_centers").insert({
        company_id: form.company_id,
        category: form.category,
        description: form.description || null,
        amount: parseFloat(form.amount),
        type: form.type,
        reference_date: form.reference_date,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-centers"] });
      setDialogOpen(false);
      setForm({ company_id: "", category: "", description: "", amount: "", type: "despesa", reference_date: format(new Date(), "yyyy-MM-dd") });
      toast({ title: "Lançamento criado!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const totalReceita = entries.filter((e: any) => e.type === "receita").reduce((s: number, e: any) => s + Number(e.amount), 0);
  const totalDespesa = entries.filter((e: any) => e.type === "despesa").reduce((s: number, e: any) => s + Number(e.amount), 0);
  const saldo = totalReceita - totalDespesa;

  const getCompanyName = (id: string) => companies.find((c) => c.id === id)?.nome_fantasia || "—";

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="bg-background min-h-screen">
      <PageHeader
        icon={Wallet}
        title="Centro de Custo"
        subtitle="Controle financeiro por empresa"
        metrics={[
          { icon: TrendingUp, label: "Receitas", value: formatCurrency(totalReceita), color: "bg-emerald-600/90" },
          { icon: TrendingDown, label: "Despesas", value: formatCurrency(totalDespesa), color: "bg-red-600/90" },
          { icon: DollarSign, label: "Saldo", value: formatCurrency(saldo), color: saldo >= 0 ? "bg-blue-600/90" : "bg-amber-600/90" },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-auto h-8 text-xs bg-white/10 border-0 text-white" />
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="h-8 text-xs w-[180px] bg-white/10 border-0 text-white"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 text-xs gap-1 bg-white/10 hover:bg-white/20 text-white border-0"><Plus className="h-3 w-3" /> Lançamento</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
                  <div className="space-y-3 mt-2">
                    <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Empresa *" /></SelectTrigger>
                      <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receita">Receita</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue placeholder="Categoria *" /></SelectTrigger>
                      <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    <Input type="number" step="0.01" placeholder="Valor (R$) *" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    <Input type="date" value={form.reference_date} onChange={(e) => setForm({ ...form, reference_date: e.target.value })} />
                    <Button
                      onClick={() => createEntry.mutate()}
                      disabled={!form.company_id || !form.category || !form.amount || createEntry.isPending}
                      className="w-full"
                    >
                      {createEntry.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />
      <main className="container mx-auto px-4 py-4 space-y-4">
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 mx-auto animate-spin" /></div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum lançamento neste período</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{format(new Date(e.reference_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-xs">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{getCompanyName(e.company_id)}</span>
                    </TableCell>
                    <TableCell className="text-xs">{e.category}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.description || "—"}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${e.type === "receita" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                        {e.type === "receita" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-medium text-sm ${e.type === "receita" ? "text-green-600" : "text-destructive"}`}>
                      {e.type === "receita" ? "+" : "-"}{formatCurrency(Number(e.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </main>
    </div>
  );
};

export default CostCenter;
