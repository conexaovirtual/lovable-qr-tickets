import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';

interface TicketAssignmentProps {
  ticket: any;
  onUpdate: () => void;
}

export function TicketAssignment({ ticket, onUpdate }: TicketAssignmentProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedTech, setSelectedTech] = useState(ticket.tecnico_id || 'unassigned');
  const [timeSpent, setTimeSpent] = useState(ticket.tempo_gasto_horas || '0');
  const [partsCost, setPartsCost] = useState(ticket.custo_pecas || '0');
  const [loading, setLoading] = useState(false);

  const canManage = profile?.roles?.some(r => ['admin_provedor', 'tecnico'].includes(r)) || false;
  const canEditFinancials = profile?.roles?.some(r => ['admin_provedor', 'gestor_cliente'].includes(r)) || false;

  useEffect(() => {
    if (canManage) {
      loadTechnicians();
    }
  }, [canManage]);

  const loadTechnicians = async () => {
    // SECURITY: Query user_roles table instead of profiles.role to prevent privilege escalation
    const { data } = await supabase
      .from('user_roles')
      .select('user_id, profiles!inner(id, nome)')
      .in('role', ['admin_provedor', 'tecnico']);

    if (data) {
      // Transform the data to match the expected format
      const techs = data.map(item => ({
        id: item.user_id,
        nome: (item.profiles as any).nome
      }));
      setTechnicians(techs);
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    const updates: any = {};

    if (selectedTech !== ticket.tecnico_id) {
      updates.tecnico_id = selectedTech === 'unassigned' ? null : selectedTech || null;
    }

    if (parseFloat(timeSpent) !== ticket.tempo_gasto_horas) {
      updates.tempo_gasto_horas = parseFloat(timeSpent);
    }

    if (parseFloat(partsCost) !== ticket.custo_pecas) {
      updates.custo_pecas = parseFloat(partsCost);
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: 'Nada para atualizar',
        variant: 'default',
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticket.id);

    if (error) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Atualizado com sucesso',
      });
      onUpdate();
    }
    setLoading(false);
  };

  if (!canManage) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Atribuição e Custos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Técnico Responsável</Label>
          <Select value={selectedTech} onValueChange={setSelectedTech}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Nenhum</SelectItem>
              {technicians.map((tech) => (
                <SelectItem key={tech.id} value={tech.id}>
                  {tech.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canEditFinancials && (
          <>
            <div className="space-y-2">
              <Label htmlFor="timeSpent">Tempo Gasto (horas)</Label>
              <Input
                id="timeSpent"
                type="number"
                step="0.5"
                min="0"
                value={timeSpent}
                onChange={(e) => setTimeSpent(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partsCost">Custo de Peças (R$)</Label>
              <Input
                id="partsCost"
                type="number"
                step="0.01"
                min="0"
                value={partsCost}
                onChange={(e) => setPartsCost(e.target.value)}
              />
            </div>
          </>
        )}

        <Button onClick={handleUpdate} disabled={loading} className="w-full">
          {loading ? 'Atualizando...' : 'Salvar Alterações'}
        </Button>
      </CardContent>
    </Card>
  );
}
