import { Badge } from "@/components/ui/badge";

type TicketStatus = 
  | 'novo' 
  | 'triagem' 
  | 'em_atendimento' 
  | 'aguardando_usuario' 
  | 'aguardando_peca' 
  | 'resolvido' 
  | 'validando_cliente' 
  | 'fechado';

type Priority = 'critica' | 'alta' | 'media' | 'baixa';

const statusLabels: Record<TicketStatus, string> = {
  novo: 'Novo',
  triagem: 'Triagem',
  em_atendimento: 'Em Atendimento',
  aguardando_usuario: 'Aguardando Usuário',
  aguardando_peca: 'Aguardando Peça',
  resolvido: 'Resolvido',
  validando_cliente: 'Validando',
  fechado: 'Fechado',
};

const priorityLabels: Record<Priority, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge variant={status}>
      {statusLabels[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant={priority}>
      {priorityLabels[priority]}
    </Badge>
  );
}
