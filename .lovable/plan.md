

## Diagnóstico: Tickets Datto NÃO estão sendo criados

### Causa Raiz

A tabela `tickets` possui uma constraint CHECK chamada `check_public_request_fields`:

```text
Se public_request = false → solicitante_id NÃO PODE ser NULL
Se public_request = true  → solicitante_nome e solicitante_contato NÃO PODEM ser NULL
```

O webhook do Datto insere tickets com `public_request = false` (default), mas **NÃO define `solicitante_id`**. Resultado: **todas as 364 inserções falharam silenciosamente** por violar essa constraint.

### Evidência

- 364 alertas HIGH/CRITICAL/WARNING registrados, **zero tickets criados** (`ticket_id = NULL` em todos)
- Nenhum ticket com `canal = 'monitoramento'` existe no banco
- Os ativos são encontrados/criados corretamente (todos têm `asset_id`)

### Correção

Adicionar `solicitante_id: TECNICO_ID` na inserção do ticket dentro de `datto-rmm-webhook/index.ts` (linha ~418). Como é um ticket gerado automaticamente pelo sistema, o técnico atribuído serve como solicitante.

**Arquivo:** `supabase/functions/datto-rmm-webhook/index.ts`

Na inserção do ticket (linhas 416-430), adicionar o campo `solicitante_id`:

```typescript
.insert({
  company_id: asset.company_id,
  titulo: `[DATTO] ${payload.alert_type || 'Alerta'}: ${payload.device_hostname || 'Dispositivo'}`,
  descricao,
  canal: 'monitoramento',
  status: 'em_atendimento',
  impacto: mapImpact(payload.alert_priority),
  urgencia: mapUrgency(payload.alert_priority),
  asset_id: asset.id,
  tecnico_id: TECNICO_ID,
  solicitante_id: TECNICO_ID,  // ← CORREÇÃO: campo obrigatório pela constraint
})
```

Após a correção, re-deploy da função.

