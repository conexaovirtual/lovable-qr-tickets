

## Plano: Dashboard Operacional Completo

### Objetivo
Criar uma nova página "Painel Operacional" que consolide em uma única tela: atendimentos diários, dispositivos online/offline, problemas mais recorrentes, distribuição por canal, e tendências — tudo com gráficos visuais.

### Dados Disponíveis (já existentes no banco)
- **daily_service_records**: atendimentos diários com canal, status, empresa, data, ativo
- **tickets**: chamados com categoria, status, empresa, SLA, datas
- **assets**: ativos com `datto_status` (online/offline/alert)
- **categories**: categorias de problemas
- **companies**: empresas clientes

### Layout da Tela

```text
┌──────────────────────────────────────────────────┐
│  PageHeader: Painel Operacional                  │
│  Métricas: Atendimentos Hoje | Online | Offline  │
├──────────────────────────────────────────────────┤
│ [KPI Cards: 6 cards em linha]                    │
│ Atend. Hoje | Atend. Semana | Online | Offline   │
│ Chamados Abertos | Taxa Resolução               │
├──────────────────────────────────────────────────┤
│ [Gráfico Barras]          │ [Gráfico Pizza]      │
│ Atendimentos por dia      │ Problemas mais       │
│ (últimos 14 dias)         │ recorrentes (top 5)  │
├──────────────────────────────────────────────────┤
│ [Gráfico Barras Horiz.]   │ [Gráfico Pizza]      │
│ Atendimentos por empresa  │ Distribuição por     │
│ (top 10)                  │ canal                │
├──────────────────────────────────────────────────┤
│ [Gráfico Linha]           │ [Status Dispositivos]│
│ Tendência semanal         │ Online vs Offline    │
│ (últimas 8 semanas)       │ por empresa          │
└──────────────────────────────────────────────────┘
```

### Implementação

**1. Criar hook `useOperationalDashboard.ts`**
- Busca `daily_service_records` dos últimos 30 dias com joins em companies/categories
- Busca `tickets` abertos e recentes
- Busca `assets` com `datto_status` para online/offline
- Calcula todas as métricas no client-side:
  - Atendimentos por dia (últimos 14 dias)
  - Top 5 problemas recorrentes (agrupando por título/descrição similar ou categoria do ticket vinculado)
  - Distribuição por canal (whatsapp, ligação, acesso remoto, presencial)
  - Atendimentos por empresa (top 10)
  - Tendência semanal
  - Dispositivos online vs offline

**2. Criar página `src/pages/OperationalDashboard.tsx`**
- Usa o PageHeader padrão
- 6 KPI cards no topo
- 3 linhas de gráficos (Recharts: BarChart, PieChart, LineChart)
- Filtro de período (7d / 14d / 30d)
- Botão de refresh

**3. Adicionar rota e menu**
- Nova rota `/operational` no App.tsx
- Link no sidebar com ícone LayoutDashboard

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/hooks/useOperationalDashboard.ts` | Novo — hook de dados operacionais |
| `src/pages/OperationalDashboard.tsx` | Novo — página com gráficos |
| `src/App.tsx` | Nova rota `/operational` |
| `src/components/layout/AppSidebar.tsx` | Link no menu |

### Detalhes Técnicos
- Recharts já está instalado e usado no projeto (BarChart, PieChart, LineChart)
- Usa o padrão PageHeader existente
- Sem necessidade de novas tabelas ou migrações
- Acesso restrito a admin e técnicos

