

## Plan: Hardware Changelog from Datto + Sync Delicata Pães

### Problem
1. The full sync updates hardware specs (`configuracoes`, `fabricante`, `modelo`, etc.) but doesn't log what changed — the "Histórico" tab stays empty for Datto-driven changes.
2. Need to verify that all Datto devices for **DELLICATA PAES** (site 129468) and **DELLICATA PAES JARDIM GOIAS** (site 175492) are correctly synced.

### Current State
- DELLICATA PAES: 16 Datto assets in platform
- DELLICATA PAES JARDIM GOIAS: 5 assets (3 Datto + 2 manual)
- The `datto-full-sync` function updates assets but never writes to `asset_changelog`

### Changes

**File: `supabase/functions/datto-full-sync/index.ts`**

When updating an existing asset (line ~393-424), add changelog logic:

1. Before updating, fetch the current asset's full data (`configuracoes`, `fabricante`, `modelo`, `numero_serie`, `sistema_operacional`, `tipo`)
2. Compare each field with the new Datto values
3. For `configuracoes` (JSON), compare key-by-key (e.g. `memoria_ram_gb`, `processador`, `armazenamento`)
4. Insert a row into `asset_changelog` for each changed field with `campo`, `valor_anterior`, `valor_novo`, and `observacao = "Sincronização Datto RMM"`
5. Use `changed_by = null` (system change) since there's no user context

This means every time a sync detects that RAM changed from 8GB to 16GB, or a disk was replaced, it will appear in the asset's "Histórico" tab automatically.

**Operational: Trigger sync for Delicata Pães**

After deploying the updated function, invoke `datto-full-sync` to run a complete sync. This will:
- Check all devices in sites 129468 and 175492 against the platform
- Create any missing Datto assets
- Update hardware specs and log changes
- Preserve the 2 manual assets (CATRACA SAIDA CLIENTES, PDV LANCHONETE)

### Technical Details

Tracked fields for changelog:
- `fabricante`, `modelo`, `numero_serie`, `sistema_operacional`, `tipo`
- `configuracoes` keys: `processador`, `memoria_ram_gb`, `memoria_ram_slots`, `armazenamento`, `placa_video`, `ip_interno`, `ip_externo`, `mac_address`, `ultimo_usuario`, `dominio`

Each change generates one `asset_changelog` row, giving full hardware audit trail.

