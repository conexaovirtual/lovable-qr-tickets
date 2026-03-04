

## Plano: Implementar Transferência Real para Técnico no WhatsApp

### Problema Identificado

Quando o `escalate_to_human` é chamado, ele apenas:
1. Desativa a IA (`ai_enabled: false`)
2. Muda o status para `waiting`
3. Insere uma mensagem de sistema no banco

**Mas ninguém é notificado.** A conversa fica parada na fila sem que nenhum técnico saiba que precisa atender. Não há push notification nem mensagem WhatsApp para a equipe.

### Solução

Adicionar notificação ativa aos técnicos quando ocorre escalonamento, usando os mesmos mecanismos já existentes no sistema (push notification + WhatsApp para técnico).

### Alterações

**Arquivo:** `supabase/functions/waba-ai-agent/index.ts`

No case `escalate_to_human` (linha ~1269), após atualizar a conversa, adicionar:

1. **Push notification** para todos os admins/técnicos via `send-push-notification` (mesmo padrão usado em `notify-ticket-created` e `check-service-orders-reminder`)
2. **Mensagem WhatsApp** para o técnico responsável (mesmo padrão já usado na criação de tickets, linhas ~1054-1085), informando o nome do cliente, resumo do problema e link/instrução para atender
3. **Mesmo tratamento para `partial_escalate`** -- enviar notificação push (sem desativar a IA)

O código já tem o padrão de notificação WhatsApp para técnico na ferramenta `create_ticket` -- será replicado para o escalonamento.

### Resultado Esperado

Quando o cliente pedir para falar com um técnico:
- A IA desativa o modo automático para aquela conversa
- Todos os técnicos/admins recebem push notification no navegador/celular
- O técnico designado (ou todos) recebe uma mensagem no WhatsApp avisando que há um cliente aguardando
- A conversa aparece na fila "Aguardando" na plataforma WhatsApp

