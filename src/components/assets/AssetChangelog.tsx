import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

interface Props {
  assetId: string;
}

export function AssetChangelog({ assetId }: Props) {
  const { data: changelog = [], isLoading } = useQuery({
    queryKey: ["asset-changelog", assetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("asset_changelog")
        .select("*, profiles:changed_by(nome)")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico de Alterações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : changelog.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma alteração registrada</p>
        ) : (
          <div className="space-y-3">
            {changelog.map((entry: any) => (
              <div key={entry.id} className="flex gap-3 text-sm border-l-2 border-primary/20 pl-3">
                <div className="flex-1">
                  <p className="font-medium">
                    <span className="text-muted-foreground">Campo:</span> {entry.campo}
                  </p>
                  <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="line-through">{entry.valor_anterior || "—"}</span>
                    <span>→</span>
                    <span className="text-foreground font-medium">{entry.valor_novo || "—"}</span>
                  </div>
                  {entry.observacao && <p className="text-xs text-muted-foreground mt-1">{entry.observacao}</p>}
                </div>
                <div className="text-xs text-muted-foreground text-right shrink-0">
                  <p>{(entry as any).profiles?.nome || "Sistema"}</p>
                  <p>{format(new Date(entry.created_at), "dd/MM HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
