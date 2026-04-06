

## Plano: Ativos Manuais vs Gerenciados pelo Datto

### Contexto

Analisando o código de sincronização (`datto-full-sync`), a lógica de limpeza **já preserva** ativos sem vínculo Datto (`datto_device_uid`/`datto_device_id` nulos) — mesmo em empresas de contrato. O problema é que **a interface não deixa isso claro**, e falta uma distinção visual entre ativos gerenciados pelo Datto e ativos cadastrados manualmente.

### O que será feito

**1. Indicador visual "Datto" vs "Manual" na listagem de ativos**
- Na `AssetList` e `AssetCard`, exibir um badge indicando a origem:
  - **"Datto"** (azul) — quando `datto_device_uid` ou `datto_device_id` existe
  - **"Manual"** (cinza) — quando não tem vínculo com Datto
- No Inventário (`Inventory.tsx`), adicionar a mesma coluna/badge de origem
- Adicionar filtro por origem (Datto / Manual / Todos) nas telas de listagem

**2. Formulário de ativo: campo de origem claro**
- No `AssetDialog`, quando o ativo for criado manualmente, garantir que os campos `datto_device_uid`, `datto_device_id` e `datto_site_id` fiquem como `null`
- Exibir um aviso informativo: "Ativos manuais não serão afetados pela sincronização com o Datto"

**3. Proteção extra na sincronização (segurança adicional)**
- Já existe proteção (linha 475-476 do sync), mas adicionar um log explícito: `[FullSync] Preservando X ativos manuais`
- Isso dá mais visibilidade no relatório de sync

**4. CMDB: mostrar origem do ativo**
- Na página CMDB, incluir badge de origem nos cards de ativos

### Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `src/components/assets/AssetList.tsx` | Badge Datto/Manual + filtro de origem |
| `src/components/assets/AssetCard.tsx` | Badge de origem |
| `src/pages/Inventory.tsx` | Coluna/badge de origem + filtro |
| `src/components/assets/AssetDialog.tsx` | Aviso informativo para ativos manuais |
| `src/pages/CMDB.tsx` | Badge de origem nos cards |
| `supabase/functions/datto-full-sync/index.ts` | Log de ativos manuais preservados no relatório |

### Resultado

- Você poderá cadastrar ativos de clientes eventuais (Hexa Tecnologia, máquinas Linux, etc.) com total segurança
- A sincronização nunca vai deletar ativos sem vínculo Datto
- Ficará visualmente claro quais ativos são monitorados e quais são manuais

