import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Network } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  assetId: string | null;
}

export function TicketImpactIndicator({ assetId }: Props) {
  const { data: impact } = useQuery({
    queryKey: ["ticket-impact", assetId],
    queryFn: async () => {
      if (!assetId) return null;

      // Get all assets that depend on this asset (this asset is parent)
      const { data: dependents } = await supabase
        .from("asset_relationships")
        .select("id, relationship_type, child:assets!asset_relationships_child_asset_id_fkey(id, nome, tipo)")
        .eq("parent_asset_id", assetId);

      // Get all assets this asset depends on (this asset is child)
      const { data: dependencies } = await supabase
        .from("asset_relationships")
        .select("id, relationship_type, parent:assets!asset_relationships_parent_asset_id_fkey(id, nome, tipo)")
        .eq("child_asset_id", assetId);

      return {
        dependents: dependents || [],
        dependencies: dependencies || [],
        totalAffected: (dependents || []).length,
      };
    },
    enabled: !!assetId,
  });

  if (!impact || impact.totalAffected === 0) return null;

  const severity = impact.totalAffected >= 5 ? "critical" : impact.totalAffected >= 2 ? "high" : "medium";

  return (
    <Card className={`border-warning/50 ${severity === "critical" ? "bg-destructive/5 border-destructive/50" : "bg-warning/5"}`}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${severity === "critical" ? "text-destructive" : "text-warning"}`} />
          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              ⚠️ Este ativo possui{" "}
              <Badge variant={severity === "critical" ? "destructive" : "secondary"} className="text-xs">
                {impact.totalAffected} {impact.totalAffected === 1 ? "dependente" : "dependentes"}
              </Badge>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {impact.dependents.map((dep: any) => (
                <div key={dep.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-card">
                  <Network className="h-3 w-3 text-muted-foreground" />
                  <span>{dep.child?.nome}</span>
                  <span className="text-muted-foreground">({dep.child?.tipo})</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {severity === "critical"
                ? "Impacto CRÍTICO: Muitos ativos serão afetados por problemas neste equipamento."
                : "Outros ativos podem ser afetados por problemas neste equipamento."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
