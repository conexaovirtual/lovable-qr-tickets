import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface AssignmentSelectProps {
  conversationId: string;
  currentAssignedTo: string | null;
}

interface Technician {
  id: string;
  nome: string;
}

export function AssignmentSelect({ conversationId, currentAssignedTo }: AssignmentSelectProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome");
      // Filter to technicians via user_roles
      if (data) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["tecnico", "admin_provedor"]);
        const techIds = new Set((roles || []).map((r: any) => r.user_id));
        setTechnicians(data.filter((p: any) => techIds.has(p.id)));
      }
    };
    load();
  }, []);

  const handleAssign = async (userId: string) => {
    const value = userId === "unassign" ? null : userId;
    const { error } = await supabase
      .from("waba_conversations")
      .update({
        assigned_to: value,
        queue_status: value ? "assigned" : "waiting",
      })
      .eq("id", conversationId);

    if (error) {
      toast.error("Erro ao atribuir técnico");
    } else {
      toast.success(value ? "Técnico atribuído" : "Conversa retornada à fila");
    }
  };

  return (
    <Select value={currentAssignedTo || "unassign"} onValueChange={handleAssign}>
      <SelectTrigger className="h-7 text-xs w-full">
        <SelectValue placeholder="Atribuir técnico..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassign">
          <span className="text-muted-foreground">Na fila (sem técnico)</span>
        </SelectItem>
        {technicians.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
