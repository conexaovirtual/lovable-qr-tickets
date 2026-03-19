

## Plano: Varredura Completa Datto → Cadastro Automático + Enriquecimento de Hardware

### Contexto
Hoje o `datto-check-offline` busca 325 dispositivos mas **só atualiza status** de ativos já cadastrados. O `datto-batch-provision` só processa alertas não-vinculados. Nenhuma função faz varredura completa com cadastro automático e coleta de hardware.

### O que será feito

**1. Nova Edge Function: `datto-full-sync`**

Uma função que executa o fluxo completo:

1. Busca **todos os dispositivos** via `GET /api/v2/account/devices` (paginado, já funcional)
2. Para cada dispositivo, busca **detalhes de hardware** via `GET /api/v2/device/{uid}` — a API do Datto retorna campos como:
   - `operatingSystem`, `processor`, `memory` (RAM em bytes), `disks`, `intIpAddress`, `extIpAddress`, `domain`, `lastSeen`, `serialNumber`
3. Cruza com a tabela `assets` por `datto_device_uid` ou `datto_device_id`
4. **Ativos existentes** → atualiza `configuracoes` (JSONB), `sistema_operacional`, `numero_serie`, `datto_status`
5. **Ativos novos** → cria automaticamente usando:
   - `nome` = hostname
   - `tipo` = inferido do hostname (servidor, notebook, desktop)
   - `company_id` = mapeado pelo `siteName` do dispositivo → busca na tabela `companies` por nome similar
   - `configuracoes` = JSON com processador, RAM, disco, IP
   - `sistema_operacional` = do campo `operatingSystem`
6. Retorna relatório detalhado: quantos atualizados, criados, não-vinculados

**2. Mapeamento de empresa por site_name dinâmico**

Em vez do mapa estático no `datto-batch-provision`, a nova função buscará `companies` do banco e fará match fuzzy pelo `nome_fantasia` contra o `siteName` do Datto. Empresas sem match serão reportadas para decisão manual.

**3. Botão "Varredura Completa" no painel Datto**

No `DattoMonitoringPanel.tsx`, adicionar um botão que:
- Chama `datto-full-sync`
- Mostra progresso e resultado (criados, atualizados, sem empresa)
- Exibe toast com resumo

**4. Campos de hardware no `configuracoes` (JSONB)**

Os dados serão salvos no campo JSONB existente `configuracoes`:
```json
{
  "processador": "Intel Core i7-10700",
  "memoria_ram_gb": 16,
  "armazenamento": [{"disco": "C:", "total_gb": 512}],
  "ip_interno": "192.168.1.100",
  "ip_externo": "200.x.x.x",
  "dominio": "empresa.local",
  "ultimo_usuario": "joao.silva"
}
```
Além disso, `sistema_operacional` e `numero_serie` serão preenchidos nas colunas dedicadas da tabela `assets`.

### Detalhes técnicos

- **Rate limiting**: A chamada `/api/v2/device/{uid}` será feita com batch de 5 requisições paralelas para não sobrecarregar a API
- **Token OAuth**: Reutiliza a infraestrutura de tokens já funcional em `datto-check-offline`
- **Sem migração de banco**: Os campos `configuracoes` (JSONB), `sistema_operacional`, `numero_serie` já existem na tabela `assets`
- **Config**: `verify_jwt = false` no `config.toml` para a nova função
- **Arquivos alterados**:
  - `supabase/functions/datto-full-sync/index.ts` (novo)
  - `supabase/config.toml` (adicionar entrada)
  - `src/components/dashboard/DattoMonitoringPanel.tsx` (botão + resultado)

