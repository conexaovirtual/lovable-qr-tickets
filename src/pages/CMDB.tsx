import { useState } from "react";
import { AssetOriginBadge } from "@/components/assets/AssetOriginBadge";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Network, Server, Monitor, Printer, Router, HardDrive, Cpu, Link2, Search, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useQuery } from "@tanstack/react-query";

const typeIcons: Record<string, any> = {
  servidor: Server, desktop: Monitor, notebook: Monitor, impressora: Printer,
  switch: Router, roteador: Router, monitor: Monitor,
};

const relationshipLabels: Record<string, string> = {
  hospeda: "Hospeda", conecta: "Conecta", depende_de: "Depende de",
  backup_de: "Backup de", virtualiza: "Virtualiza",
};

export default function CMDB() {
  const [filterCompany, setFilterCompany] = useState("all");
  const [search, setSearch] = useState("");

  const { data: companies = [] } = useQuery({
    queryKey: ["cmdb-companies"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, nome_fantasia").eq("status", true).order("nome_fantasia");
      return data || [];
    },
  });

  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ["cmdb-assets", filterCompany],
    queryFn: async () => {
      let query = supabase.from("assets").select("id, nome, tipo, estado, company_id, datto_device_uid, datto_device_id, companies(nome_fantasia)").order("nome");
      if (filterCompany !== "all") query = query.eq("company_id", filterCompany);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: relationships = [], isLoading: loadingRels } = useQuery({
    queryKey: ["cmdb-relationships"],
    queryFn: async () => {
      const { data } = await supabase.from("asset_relationships").select(`
        id, relationship_type,
        parent:assets!asset_relationships_parent_asset_id_fkey(id, nome, tipo, company_id),
        child:assets!asset_relationships_child_asset_id_fkey(id, nome, tipo, company_id)
      `);
      return data || [];
    },
  });

  const filteredAssets = assets.filter((a: any) =>
    (!search || a.nome.toLowerCase().includes(search.toLowerCase()))
  );

  // Stats
  const assetsWithRelationships = new Set<string>();
  relationships.forEach((r: any) => {
    if (r.parent) assetsWithRelationships.add(r.parent.id);
    if (r.child) assetsWithRelationships.add(r.child.id);
  });

  const criticalAssets = assets.filter((a: any) => {
    const deps = relationships.filter((r: any) => r.parent?.id === a.id);
    return deps.length >= 2;
  });

  const orphanAssets = filteredAssets.filter((a: any) => !assetsWithRelationships.has(a.id));

  const isLoading = loadingAssets || loadingRels;

  return (
    <div className="space-y-6">
      <PageHeader icon={Network} title="CMDB" subtitle="Banco de dados de configuração e mapa de infraestrutura" />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <HardDrive className="h-8 w-8 text-primary" />
          <div><p className="text-sm text-muted-foreground">Total de Ativos</p><p className="text-2xl font-bold">{assets.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Link2 className="h-8 w-8 text-info" />
          <div><p className="text-sm text-muted-foreground">Relacionamentos</p><p className="text-2xl font-bold">{relationships.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-warning" />
          <div><p className="text-sm text-muted-foreground">Ativos Críticos</p><p className="text-2xl font-bold">{criticalAssets.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Cpu className="h-8 w-8 text-muted-foreground" />
          <div><p className="text-sm text-muted-foreground">Sem Vínculo</p><p className="text-2xl font-bold">{orphanAssets.length}</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar ativo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-60" />
        </div>
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Empresas</SelectItem>
            {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Critical assets alert */}
          {criticalAssets.length > 0 && (
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" /> Ativos Críticos (2+ dependências)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {criticalAssets.map((a: any) => {
                    const depCount = relationships.filter((r: any) => r.parent?.id === a.id).length;
                    const Icon = typeIcons[a.tipo] || Cpu;
                    return (
                      <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{a.nome}</span>
                        <AssetOriginBadge asset={a} size="sm" />
                        <Badge variant="destructive" className="text-[10px]">{depCount} dep.</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Relationship graph */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mapa de Relacionamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {relationships.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum relacionamento cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {relationships.map((rel: any) => {
                    const ParentIcon = typeIcons[rel.parent?.tipo] || Cpu;
                    const ChildIcon = typeIcons[rel.child?.tipo] || Cpu;
                    return (
                      <div key={rel.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/30 transition-colors flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <ParentIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{rel.parent?.nome || "?"}</span>
                          <Badge variant="outline" className="text-[10px]">{rel.parent?.tipo}</Badge>
                        </div>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                          {relationshipLabels[rel.relationship_type] || rel.relationship_type}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <div className="flex items-center gap-1.5">
                          <ChildIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{rel.child?.nome || "?"}</span>
                          <Badge variant="outline" className="text-[10px]">{rel.child?.tipo}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orphan assets */}
          {orphanAssets.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-muted-foreground">Ativos sem Relacionamento ({orphanAssets.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {orphanAssets.slice(0, 50).map((a: any) => {
                    const Icon = typeIcons[a.tipo] || Cpu;
                    return (
                      <div key={a.id} className="flex items-center gap-1.5 p-1.5 rounded border bg-card text-xs">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        <span>{a.nome}</span>
                        <AssetOriginBadge asset={a} size="sm" />
                      </div>
                    );
                  })}
                  {orphanAssets.length > 50 && <span className="text-xs text-muted-foreground self-center">+{orphanAssets.length - 50} mais</span>}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
