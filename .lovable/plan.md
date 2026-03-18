

## Diagnóstico: Todos os dispositivos marcados como Offline

### Problema identificado

A função `datto-check-offline` marcou **todos os 210 dispositivos como offline** porque o campo `datto_last_sync` só é atualizado quando o Datto envia um **alerta** (webhook de alert). Dispositivos que estão funcionando normalmente e sem alertas nunca atualizam seu `datto_last_sync`, e após 15 minutos sem atualização, são marcados como offline.

Resumindo: o webhook do Datto RMM **não é um heartbeat** — ele só dispara em eventos de alerta. Logo, usar `datto_last_sync` como indicador de conectividade não funciona com a arquitetura atual.

Além disso, o log do webhook mostra um erro de parsing JSON (`Bad control character in string literal`), indicando que alguns webhooks estão falhando.

### Solução proposta

Usar a **API REST do Datto RMM** para consultar o status real dos dispositivos periodicamente, em vez de depender dos webhooks. O Datto já possui os secrets configurados (`DATTO_API_URL`, `DATTO_API_KEY`, `DATTO_API_SECRET`).

**1. Reescrever a Edge Function `datto-check-offline`**

Em vez de apenas verificar timestamps, a função vai:
- Autenticar na API do Datto RMM (OAuth2 com client credentials)
- Buscar a lista de dispositivos via `GET /api/v2/account/devices`
- Para cada dispositivo, verificar o campo `online` retornado pela API
- Atualizar `datto_status` e `datto_last_sync` nos ativos correspondentes (match por `datto_device_id`)
- Dispositivos que a API retorna como offline → `datto_status = 'offline'`
- Dispositivos que a API retorna como online → `datto_status = 'online'` + `datto_last_sync = now()`

**2. Manter o cron job existente** (a cada 5 minutos)

**3. Nenhuma alteração no frontend** — o Monitor de Rede já lê `datto_status` corretamente

### Pré-requisito

Verificar se os secrets `DATTO_API_URL`, `DATTO_API_KEY` e `DATTO_API_SECRET` estão configurados. Caso não estejam, será necessário adicioná-los antes da implementação.

### Arquivos afetados
- `supabase/functions/datto-check-offline/index.ts` — reescrever para usar API REST do Datto

