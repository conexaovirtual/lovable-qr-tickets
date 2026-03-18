

## Dashboard de Monitoramento de Internet por Cliente

### Contexto
Seu sistema ja possui integração com o Datto RMM, com o campo `datto_status` nos ativos (online/alert/offline) e o painel `DattoMonitoringPanel` no dashboard. A proposta e criar uma pagina dedicada que agrupa essas informações **por empresa**, dando uma visão clara de quem está online e quem caiu.

### O que será construído

**1. Nova página `/network-monitor`** — Dashboard de Conectividade

Layout:
```text
┌─────────────────────────────────────────────────┐
│  📡 Monitor de Conectividade                    │
├─────────────────────────────────────────────────┤
│  [🟢 12 Online] [🟡 2 Alertas] [🔴 1 Offline]  │
├─────────────────────────────────────────────────┤
│  🔍 Buscar empresa...    [Filtro: Todos ▼]      │
├─────────────────────────────────────────────────┤
│  ┌──────────────────┐ ┌──────────────────┐      │
│  │ Empresa ABC      │ │ Empresa XYZ      │      │
│  │ 🟢 3/3 Online    │ │ 🔴 1/2 Offline   │      │
│  │ Último sync: 5m  │ │ Último sync: 2m  │      │
│  │ ► Servidor-01 🟢 │ │ ► Router-01  🔴  │      │
│  │ ► Desktop-03 🟢 │ │ ► Desktop-05 🟢  │      │
│  │ ► Switch-02  🟢 │ │                   │      │
│  └──────────────────┘ └──────────────────┘      │
│  ...                                             │
└─────────────────────────────────────────────────┘
```

Funcionalidades:
- Cards por empresa agrupando dispositivos monitorados (que possuem `datto_device_id`)
- Status visual por empresa: verde (todos online), amarelo (algum alerta), vermelho (algum offline)
- Expandir para ver dispositivos individuais com status
- Filtro para mostrar apenas empresas com problemas (offline/alert)
- Busca por nome da empresa
- Indicador de último sync (`datto_last_sync`)
- Atualização automática a cada 60 segundos

**2. Link no sidebar** — Seção "Recursos", visível para admin e técnicos

### Detalhes técnicos

- **Dados**: Query em `assets` onde `datto_device_id IS NOT NULL`, com join em `companies`
- **Agrupamento**: Frontend agrupa por `company_id` e calcula totais online/alert/offline por empresa
- **Refresh**: `refetchInterval: 60000` no React Query
- **Sem migração**: Usa tabelas e campos existentes (`assets.datto_status`, `assets.datto_last_sync`)
- **Arquivos**:
  - Criar `src/pages/NetworkMonitor.tsx`
  - Editar `src/App.tsx` (rota `/network-monitor`)
  - Editar `src/components/layout/AppSidebar.tsx` (link no menu)

