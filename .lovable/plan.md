

## Agendamento Inteligente com Classificação Remoto vs Presencial

### Conceito

O scheduler precisa distinguir dois tipos de atendimento:

1. **Presencial** (on-site): Bloqueia um slot de 2h. Apenas 4 slots/dia (08-10, 10-12, 14-16, 16-18). Não pode sobrepor.
2. **Remoto**: Não bloqueia slot. Pode ser agendado em qualquer horário entre 08:00 e 18:00, sem limite de sobreposição.

A IA classifica automaticamente se o atendimento pode ser remoto com base no tipo de alerta/problema (ex: ajuste de sistema, erro de software → remoto; hardware, rede física → presencial).

### Implementação

#### 1. Nova coluna `modalidade` na tabela `service_orders`

```sql
ALTER TABLE service_orders 
  ADD COLUMN modalidade text DEFAULT 'presencial' 
  CHECK (modalidade IN ('remoto', 'presencial'));
```

#### 2. Nova Edge Function `smart-scheduler`

Recebe `tecnico_id`, `data_desejada`, `modalidade` (remoto/presencial).

- **Se remoto**: Retorna a data desejada + horário 08:00 (informativo). Não verifica conflitos.
- **Se presencial**: Consulta OS presenciais do técnico no dia, identifica slots de 2h livres, retorna o próximo disponível. Se dia cheio, avança para o próximo dia útil (pula sáb/dom).

#### 3. Classificação automática via IA

No `datto-rmm-webhook`, após receber o alerta, a IA classifica se o problema pode ser resolvido remotamente com base em:
- `alert_type` e `alert_category` (ex: software, service, disk → remoto; hardware failure → presencial)
- Fallback: se a categoria contém "software", "service", "patch", "update" → remoto. Senão → presencial.

No `waba-ai-agent`, a IA já tem contexto da conversa e pode decidir se é remoto ou presencial antes de criar o ticket.

#### 4. Pontos de integração (3 locais)

1. **`datto-rmm-webhook`**: Após criar ticket, classificar modalidade via IA, chamar `smart-scheduler`, criar OS com slot + modalidade.
2. **`waba-ai-agent` → `create_ticket`**: IA classifica modalidade, chama `smart-scheduler`, cria OS vinculada e informa previsão ao cliente.
3. **`useVisitSchedule.ts`**: Visitas preventivas são sempre presenciais. Usar `smart-scheduler` para obter slot em vez de fixar 09:00.

### Detalhes Técnicos

```text
Slots presenciais (bloqueantes):
  08:00-10:00  |  10:00-12:00  |  14:00-16:00  |  16:00-18:00

Remotos: qualquer horário 08-18h, sem bloqueio

Classificação automática:
  Remoto → software, service, patch, update, config, backup, policy
  Presencial → hardware, disk physical, network cable, printer jam, replacement
```

A edge function `smart-scheduler`:
- Input: `{ tecnico_id, data_desejada?, modalidade, prioridade? }`
- Output: `{ data, hora_inicio, hora_fim, modalidade }`
- Para prioridade crítica presencial: tenta encaixar no mesmo dia antes de avançar

### Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Adicionar coluna `modalidade` em `service_orders` |
| `supabase/functions/smart-scheduler/index.ts` | Nova função |
| `supabase/config.toml` | Registrar `smart-scheduler` com `verify_jwt = false` |
| `supabase/functions/datto-rmm-webhook/index.ts` | Classificar + agendar OS após ticket |
| `supabase/functions/waba-ai-agent/index.ts` | Classificar + agendar OS no `create_ticket` |
| `src/hooks/useVisitSchedule.ts` | Usar scheduler para visitas presenciais |

