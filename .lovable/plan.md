

## Atualização do Número do WhatsApp

O número de atendimento da Conexão Virtual para os QR Codes das etiquetas e notificações precisa ser **62 9 8451-5801** (5562984515801), não o número atual (5562999522470).

### O que será atualizado

1. **Plano de implementação das etiquetas** — o QR Code WhatsApp apontará para `wa.me/5562984515801` em vez do número antigo

2. **`datto-rmm-webhook/index.ts`** — atualizar `TECNICO_PHONE` de `5562999522470` para `5562984515801` (notificações de alerta Datto)

3. **`waba-ai-agent/index.ts`** — atualizar `TECNICO_PHONE` de `5562999522470` para `5562984515801` (escalonamento de tickets)

4. **Novo componente `AssetLabelPrint.tsx`** — criar etiqueta 50x50mm com QR Code apontando para `wa.me/5562984515801?text=[ASSET:uuid] Suporte: NomeMaquina - Local`

5. **Detecção de `[ASSET:uuid]` no `waba-ai-agent`** — reconhecer o tag na mensagem recebida, buscar dados do ativo e histórico, contextualizar o atendimento

6. **Botão "Imprimir Etiqueta"** no `AssetCard.tsx`

### Confirmação

- O número **62 9 8451-5801** é o número de atendimento da Conexão Virtual (o que recebe mensagens dos clientes)
- O número antigo (62 9 9952-2470) é o do técnico José Pereira — será mantido apenas se houver necessidade de notificação direta ao técnico

Preciso confirmar: o número antigo (9 9952-2470) ainda deve ser usado para notificar o técnico nos alertas Datto, ou tudo deve ir para o 9 8451-5801?

