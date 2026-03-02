

## Plano: Módulo de Agenda Unificada com Resumo Diário via WhatsApp

### Visão Geral

Criar uma **agenda centralizada** que consolida todas as atividades (OS, tickets, atendimentos diários, alertas Datto) em uma visão única, acessível pela IA do WhatsApp, e com envio automático de resumo diário para José Pereira.

---

### 1. Página de Agenda Unificada (`/agenda`)

**Novo arquivo: `src/pages/Agenda.tsx`**

Uma página com calendário mensal + lista do dia selecionado, consolidando dados de:
- `service_orders` (OS agendadas)
- `tickets` (chamados abertos/em atendimento)
- `daily_service_records` (atendimentos do dia)
- `visit_schedules` (visitas programadas)

Funcionalidades:
- Calendário mensal com indicadores visuais por tipo (OS = azul, ticket = laranja, atendimento = verde, visita = roxo)
- Clique no dia mostra lista detalhada de todos os compromissos
- Filtros por tipo de atividade
- Link rápido para criar nova OS ou registrar atendimento

**Registrar rota em `App.tsx`**: `/agenda`

**Adicionar link na navegação em `AppHeader.tsx`**: ícone de calendário "Agenda"

---

### 2. Edge Function: Resumo Diário via WhatsApp

**Novo arquivo: `supabase/functions/daily-agenda-summary/index.ts`**

Executada via cron às **07:00** (horário de Brasília), envia um resumo completo para o WhatsApp de José Pereira (`5562984515801`):

- Busca todas as OS agendadas para o dia (`service_orders`)
- Busca tickets abertos/em atendimento (`tickets`)
- Busca visitas programadas (`visit_schedules`)
- Busca atendimentos já registrados no dia (`daily_service_records`)
- Usa IA (Gemini Flash) para gerar um resumo organizado e priorizado
- Envia via Mabbix WhatsApp API

Formato da mensagem:
```
📋 *Resumo do Dia - DD/MM/AAAA*

📅 *Agenda de Atendimentos (X itens):*
• 08:00 - OS #123 - Empresa X (Preventivo, presencial)
• 10:00 - OS #456 - Empresa Y (Corretivo, remoto)
...

🎫 *Chamados Abertos (X):*
• #789 - Título (urgência alta)
...

🔔 *Novas OS Abertas Ontem (X):*
• OS #101 - Empresa Z
...

💡 *Recomendação IA:*
Priorize o atendimento X por risco de SLA...
```

**Configurar cron** (via `pg_cron`):
- Executar `daily-agenda-summary` todos os dias às 10:00 UTC (07:00 BRT)

---

### 3. Ferramenta de Agenda no Agente WhatsApp

**Atualizar: `supabase/functions/waba-ai-agent/index.ts`**

Adicionar nova ferramenta `check_agenda` ao agente IA:

```
check_agenda(data?: string)
```
- Se data não informada, usa hoje
- Consulta OS, tickets, visitas e atendimentos do dia
- Retorna resumo estruturado para a IA responder ao José

Adicionar ferramenta `create_schedule` para a IA criar agendamentos:
```
create_schedule(titulo, descricao, data, hora, company_id?, tipo_servico?)
```
- Cria uma OS via Smart Scheduler
- Permite que José peça à IA para agendar compromissos pelo WhatsApp

Atualizar o **system prompt** para incluir capacidades de agenda:
- "12. CONSULTAR AGENDA: verificar compromissos de qualquer dia"
- "13. CRIAR AGENDAMENTO: agendar atendimentos e compromissos"

---

### 4. Contexto de Agenda no `gatherContext`

**Atualizar: `supabase/functions/waba-ai-agent/index.ts`** (função `gatherContext`)

Adicionar consulta à agenda do dia atual para que a IA sempre saiba o que está programado:
- OS do dia (com horário, empresa, tipo)
- Tickets pendentes
- Visitas do dia

Incluir seção no system prompt:
```
═══════════════════════════════════════
📅 AGENDA DE HOJE:
═══════════════════════════════════════
• 08:00 - OS #123 - Empresa X (preventivo)
...
```

---

### Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/pages/Agenda.tsx` |
| Criar | `supabase/functions/daily-agenda-summary/index.ts` |
| Editar | `src/App.tsx` (nova rota /agenda) |
| Editar | `src/components/layout/AppHeader.tsx` (link Agenda) |
| Editar | `supabase/functions/waba-ai-agent/index.ts` (tools + context + prompt) |
| Editar | `supabase/config.toml` (config da nova function) |
| SQL | Criar cron job para resumo diário às 07:00 BRT |

