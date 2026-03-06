

## Plano: Redesign Inspirado no Infradesk Service Desk

Esse projeto envolve muitas mudanças. Recomendo dividir em **fases incrementais** para evitar quebrar funcionalidades existentes. Abaixo está o plano completo.

---

### O que o Infradesk tem (e comparação com o que voce ja tem)

| Funcionalidade | Infradesk | Conexao Help Desk | Status |
|---|---|---|---|
| Chamados/Tickets | Kanban (arrastar entre colunas) | Lista com filtros | Precisa criar |
| Gestao de Ativos/Patrimonios | Sim | Sim | Ja tem |
| Dashboard com metricas | Sim | Sim | Melhorar visual |
| Chat Corporativo interno | Sim | Nao tem | Precisa criar |
| Projetos | Sim | Nao tem | Precisa criar |
| Centro de Custo | Sim | Nao tem | Precisa criar |
| Sidebar fixa com icones | Sim (lateral escura) | Header horizontal | Precisa migrar |
| Base de Conhecimento | Sim | Sim | Ja tem |
| App/PWA | Sim | Sim (PWA) | Ja tem |

---

### Fase 1 -- Layout e Navegacao (prioridade)

**Migrar de header horizontal para sidebar lateral** igual ao Infradesk:

- Criar `AppSidebar` com Shadcn Sidebar (`collapsible="icon"`)
- Sidebar escura com logo no topo, icones para cada modulo
- Remover `AppHeader` e substituir por sidebar + header compacto com perfil/notificacoes
- Layout wrapper com `SidebarProvider` envolvendo todas as paginas autenticadas
- Mobile: sidebar offcanvas com trigger no header

**Arquivos afetados:**
- Criar `src/components/layout/AppSidebar.tsx`
- Criar `src/components/layout/AppLayout.tsx` (wrapper com SidebarProvider)
- Atualizar `src/App.tsx` para usar AppLayout nas rotas autenticadas
- Deprecar `src/components/layout/AppHeader.tsx`

---

### Fase 2 -- Kanban de Chamados

**Adicionar visao Kanban na pagina de Tickets**, com colunas:
- Aberto | Em Atendimento | Aguardando Cliente | Resolvido | Fechado

- Cada chamado como card arrastavel com: numero, empresa, prioridade, tecnico, tempo
- Toggle entre visao Lista (atual) e Kanban
- Arrastar para mudar status (update no banco)
- Usa os dados ja existentes da tabela `tickets`

**Arquivos afetados:**
- Criar `src/components/tickets/TicketKanban.tsx`
- Atualizar `src/pages/Tickets.tsx` para toggle Lista/Kanban

---

### Fase 3 -- Dashboard Redesign

- Redesenhar o dashboard com cards mais visuais e coloridos
- Graficos de desempenho (tickets por status, SLA, tempo medio)
- Secao de "Meus Atendimentos" com contadores por status
- Widget de agenda do dia integrado

**Arquivos afetados:**
- Atualizar `src/pages/Dashboard.tsx`

---

### Fase 4 -- Chat Corporativo Interno

- Chat em tempo real entre tecnicos e gestores
- Usar tabelas novas: `chat_channels`, `chat_messages`
- Realtime via Supabase
- Sidebar ou pagina dedicada `/chat`

**Novas tabelas necessarias** (migracao):
- `chat_channels` (id, name, type, created_at)
- `chat_messages` (id, channel_id, user_id, content, created_at)

---

### Fase 5 -- Projetos e Centro de Custo

- Modulo de projetos com tarefas e acompanhamento
- Centro de custo por empresa/contrato
- Tabelas novas necessarias

---

### Recomendacao

Sugiro comecar pela **Fase 1 (Sidebar)** pois muda toda a base visual e ja deixa a plataforma com a cara do Infradesk. Depois seguimos fase por fase.

Quer que eu comece pela Fase 1?

