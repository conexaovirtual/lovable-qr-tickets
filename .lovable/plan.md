

## Correção: Dispositivos Offline Não Detectados

### Problema Identificado

O webhook do Datto RMM só dispara quando há **alertas**. Na linha que atualiza o status do ativo, a lógica é:

```
status = alertlevel === 'triggered' ? 'alert' : 'online'
```

Ou seja, o sistema **nunca marca um dispositivo como "offline"** — ele só recebe "alert" ou "online" quando o Datto envia um alerta. Se um dispositivo simplesmente desliga e para de comunicar, nenhum webhook é enviado, e o status permanece "online" para sempre.

### Solução

Criar uma **Edge Function agendada** que roda periodicamente (a cada 5 minutos via pg_cron) e verifica o campo `datto_last_sync` de todos os ativos monitorados. Se o último sync for mais antigo que **15 minutos**, o dispositivo é marcado como `offline`.

### O que será construído

**1. Nova Edge Function `datto-check-offline`**
- Busca todos os ativos com `datto_device_id` não nulo
- Se `datto_last_sync` > 15 min atrás → marca `datto_status = 'offline'`
- Se `datto_last_sync` entre 10-15 min → marca `datto_status = 'alert'` (aviso de possível queda)
- Loga quantos dispositivos foram atualizados

**2. Agendamento via pg_cron**
- Migração SQL para criar um job que chama a função a cada 5 minutos
- Usa `pg_net` + `pg_cron` (já configurados no projeto)

**3. Correção no webhook existente**
- Quando o webhook recebe um alerta com `alertlevel = 'resolved'`, marcar status como `'online'` (já funciona)
- Garantir que o `datto_last_sync` é sempre atualizado no webhook (já funciona)

### Detalhes técnicos

- **Arquivos**:
  - Criar `supabase/functions/datto-check-offline/index.ts`
  - Atualizar `supabase/config.toml` (adicionar função)
  - Migração SQL para o cron job
- **Threshold**: 15 minutos sem sync = offline, configurável
- **Sem alteração no frontend**: o `NetworkMonitor.tsx` já lê `datto_status` corretamente

