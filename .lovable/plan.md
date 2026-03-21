

## Plano: Capturar dados de hardware (processador, memória) na varredura Datto

### Problema
A varredura completa (`datto-full-sync`) já busca detalhes de cada dispositivo via `/api/v2/device/{uid}`, mas os campos de processador e memória **não estão sendo mapeados** — provavelmente porque a API do Datto retorna esses dados com nomes de campo diferentes dos esperados pelo código.

Atualmente o `configuracoes` só traz: `dominio`, `ip_externo`, `ip_interno`, `ultimo_usuario`. Faltam processador, RAM, discos.

### O que será feito

**1. Adicionar logging diagnóstico na Edge Function**

No `datto-full-sync/index.ts`, logar o JSON completo do primeiro dispositivo retornado pelo endpoint `/api/v2/device/{uid}` para descobrir os nomes exatos dos campos da API Datto.

**2. Ampliar o mapeamento de campos em `buildConfiguracoes`**

Atualizar a função para cobrir todos os campos conhecidos da API Datto v2, incluindo variações:
- **Processador**: `processor`, `cpuName`, `cpu`, `processorName`, `deviceAudit.processor`
- **Memória RAM**: `memory`, `totalMemory`, `memoryTotal`, `ram`, `physicalMemory`, `deviceAudit.memory`
- **Discos**: `disks`, `drives`, `diskDrives`, `volumes`
- Buscar dentro de objetos aninhados como `deviceAudit`, `systemInfo`, `hardwareInfo`

**3. Testar via invocação direta**

Chamar a função após o deploy para verificar nos logs o formato real da resposta e confirmar que processador/memória são capturados.

**4. Re-sincronizar todos os ativos existentes**

A varredura já atualiza ativos existentes — após a correção, basta rodar novamente pelo botão "Varredura Completa" para preencher os dados faltantes.

### Detalhes técnicos

- **1 arquivo alterado**: `supabase/functions/datto-full-sync/index.ts`
- **Sem migração de banco**: os campos `configuracoes` (JSONB), `sistema_operacional`, `numero_serie` já existem
- Redeploy da função após alteração
- Abordagem iterativa: primeiro logar a resposta real, depois ajustar o mapeamento

