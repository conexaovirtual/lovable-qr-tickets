---
name: Jose Pereira — Perfil e política de atribuição
description: ID do único técnico, telefone WhatsApp para notificações da IA, regras de atribuição
type: feature
---

# Jose Pereira — Técnico único

- **profile.id (tecnico_id):** `e336e78e-c11a-48b5-8d69-2bb48cf6bb3b`
- **WhatsApp para notificações da IA:** `5562999522470` (DDI 55 + DDD 62 + 99952-2470)
  - Usado em waba-ai-agent para escalate_to_human, partial_escalate, create_ticket e create_schedule.
  - NÃO usar `5562984515801` (número antigo, removido).
- Único técnico ativo da Conexão Virtual. Toda atribuição de OS, agendamento e escalonamento WhatsApp vai pra ele.

# Política de notificação automática (waba-ai-agent)
A IA dispara WhatsApp para o número acima quando:
1. **create_ticket** → notifica chamado novo aberto via IA
2. **escalate_to_human** → cliente pediu falar com técnico/humano
3. **partial_escalate** → assuntos sensíveis (reclamação, comercial, decisão)
4. **create_schedule** → agendamento criado via IA

Push notifications também vão para roles `admin_provedor` e `tecnico` em escalonamentos.
