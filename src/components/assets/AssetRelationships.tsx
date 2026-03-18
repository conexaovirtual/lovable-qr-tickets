import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Link2, ArrowRight, Trash2, Loader2, Network } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const relationshipLabels: Record<string, { label: string; color: string }> = {
  hospeda: { label: "Hospeda", color: "bg-primary text-primary-foreground" },
  conecta: { label: "Conecta", color: "bg-info text-info-foreground" },
  depende_de: { label: "Depende de", color: "bg-warning text-warning-foreground" },
  backup_de: { label: "Backup de", color: "bg-success text-success-foreground" },
  virtualiza: { label: "Virtualiza", color: "bg-accent text-accent-foreground" },
};

interface Props {
  assetId: string;
  companyId: string;
}

export function AssetRelationships({ assetId, companyId }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ child_asset_id: "", relationship_type: "conecta" });

  const isAdminOrTech = profile?.roles?.some(r => r === "admin_provedor" || r === "tecnico");

  const { data: relationships = [], isLoading } = useQuery({
    queryKey: ["asset-relationships", assetId],
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

  const { data: companyAssets = [] } = useQuery({
    queryKey: ["company-assets-for-rel", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("id, nome, tipo").eq("company_id", companyId).neq("id", assetId).order("nome");
      return data || [];
    },
    enabled: dialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("asset_relationships").insert({
        parent_asset_id: assetId,
        child_asset_id: form.child_asset_id,
        relationship_type: form.relationship_type as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-relationships", assetId] });
      setDialogOpen(false);
      setForm({ child_asset_id: "", relationship_type: "conecta" });
      toast({ title: "Relacionamento criado!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("asset_relationships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-relationships", assetId] });
      toast({ title: "Relacionamento removido" });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4" /> Relacionamentos CMDB
          </CardTitle>
          {isAdminOrTech && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Relacionamento</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Tipo de Relacionamento</Label>
                    <Select value={form.relationship_type} onValueChange={(v) => setForm({ ...form, relationship_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(relationshipLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ativo Relacionado</Label>
                    <Select value={form.child_asset_id} onValueChange={(v) => setForm({ ...form, child_asset_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o ativo" /></SelectTrigger>
                      <SelectContent>
                        {companyAssets.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>{a.nome} ({a.tipo})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => createMutation.mutate()} disabled={!form.child_asset_id || createMutation.isPending} className="w-full">
                    {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Criar Relacionamento
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : relationships.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum relacionamento cadastrado</p>
        ) : (
          <div className="space-y-2">
            {relationships.map((rel: any) => {
              const info = relationshipLabels[rel.relationship_type] || { label: rel.relationship_type, color: "bg-muted" };
              return (
                <div key={rel.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                  <Badge className={info.color}>{info.label}</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Link2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-medium flex-1">{rel.related?.nome || "?"}</span>
                  <Badge variant="outline" className="text-xs">{rel.related?.tipo}</Badge>
                  {isAdminOrTech && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteMutation.mutate(rel.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
