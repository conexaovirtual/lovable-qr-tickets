import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Network, Server, Monitor, Printer, Router, HardDrive, Cpu } from "lucide-react";

const typeIcons: Record<string, any> = {
  servidor: Server,
  desktop: Monitor,
  notebook: Monitor,
  impressora: Printer,
  switch: Router,
  roteador: Router,
  monitor: Monitor,
};

const relationshipColors: Record<string, string> = {
  hospeda: "bg-primary",
  conecta: "bg-info",
  depende_de: "bg-warning",
  backup_de: "bg-success",
  virtualiza: "bg-accent",
};

const relationshipLabels: Record<string, string> = {
  hospeda: "Hospeda",
  conecta: "Conecta",
  depende_de: "Depende de",
  backup_de: "Backup de",
  virtualiza: "Virtualiza",
};

interface Props {
  assetId: string;
  assetName: string;
  assetType: string;
}

export function AssetRelationshipMap({ assetId, assetName, assetType }: Props) {
  const { data: relationships = [], isLoading } = useQuery({
    queryKey: ["asset-relationship-map", assetId],
    queryFn: async () => {
      const [{ data: asParent }, { data: asChild }] = await Promise.all([
        supabase.from("asset_relationships").select("*, child:assets!asset_relationships_child_asset_id_fkey(id, nome, tipo)").eq("parent_asset_id", assetId),
        supabase.from("asset_relationships").select("*, parent:assets!asset_relationships_parent_asset_id_fkey(id, nome, tipo)").eq("child_asset_id", assetId),
      ]);
      return [
        ...(asParent || []).map((r: any) => ({ ...r, direction: "out", related: r.child })),
        ...(asChild || []).map((r: any) => ({ ...r, direction: "in", related: r.parent })),
      ];
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (relationships.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Network className="h-12 w-12 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhum relacionamento mapeado</p>
      </div>
    );
  }

  const outgoing = relationships.filter((r: any) => r.direction === "out");
  const incoming = relationships.filter((r: any) => r.direction === "in");
  const CenterIcon = typeIcons[assetType] || Cpu;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Network className="h-4 w-4" /> Mapa de Infraestrutura
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative flex flex-col items-center gap-2 py-4">
          {/* Incoming (parents / depends on this) */}
          {incoming.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 mb-2">
              {incoming.map((rel: any) => {
                const Icon = typeIcons[rel.related?.tipo] || HardDrive;
                return (
                  <div key={rel.id} className="flex flex-col items-center gap-1">
                    <div className="p-2 rounded-lg border bg-card shadow-sm">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-medium max-w-[80px] truncate">{rel.related?.nome}</span>
                    <Badge variant="outline" className="text-[10px] px-1">{rel.related?.tipo}</Badge>
                  </div>
                );
              })}
            </div>
          )}

          {/* Connection lines up */}
          {incoming.length > 0 && (
            <div className="flex flex-col items-center gap-0.5">
              {incoming.map((rel: any) => (
                <Badge key={rel.id} className={`${relationshipColors[rel.relationship_type] || "bg-muted"} text-[10px] px-1.5`}>
                  {relationshipLabels[rel.relationship_type] || rel.relationship_type}
                </Badge>
              ))}
              <div className="w-px h-4 bg-border" />
            </div>
          )}

          {/* Center node */}
          <div className="relative z-10 p-4 rounded-xl border-2 border-primary bg-primary/5 shadow-md flex flex-col items-center gap-1">
            <CenterIcon className="h-8 w-8 text-primary" />
            <span className="font-semibold text-sm">{assetName}</span>
            <Badge className="text-[10px]">{assetType}</Badge>
          </div>

          {/* Connection lines down */}
          {outgoing.length > 0 && (
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-px h-4 bg-border" />
              {outgoing.map((rel: any) => (
                <Badge key={rel.id} className={`${relationshipColors[rel.relationship_type] || "bg-muted"} text-[10px] px-1.5`}>
                  {relationshipLabels[rel.relationship_type] || rel.relationship_type}
                </Badge>
              ))}
            </div>
          )}

          {/* Outgoing (children / hosted by this) */}
          {outgoing.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {outgoing.map((rel: any) => {
                const Icon = typeIcons[rel.related?.tipo] || HardDrive;
                return (
                  <div key={rel.id} className="flex flex-col items-center gap-1">
                    <div className="p-2 rounded-lg border bg-card shadow-sm">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-medium max-w-[80px] truncate">{rel.related?.nome}</span>
                    <Badge variant="outline" className="text-[10px] px-1">{rel.related?.tipo}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
