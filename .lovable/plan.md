

# Plano: IA para Mapa de Visitas e Cobranca Automatica

## Objetivo

Criar uma IA que analise seus clientes e gere automaticamente um **mapa de visitas preventivas**, considerando:
- Empresas negligenciadas (sem visita ha muito tempo)
- Historico de chamados e atendimentos
- Frequencia ideal de visitas por empresa
- Cobranca automatica via notificacoes push

---

## Arquitetura da Solucao

```text
+------------------+     +-------------------------+     +------------------+
|  Pagina Analytics|---->|  Edge Function          |---->|  Lovable AI      |
|  (Botao Gerar)   |     |  ai-visit-planner       |     |  (Gemini Flash)  |
+------------------+     +-------------------------+     +------------------+
                                    |
                                    v
                         +------------------+
                         |  Mapa de Visitas |
                         |  + Alertas CRON  |
                         +------------------+
```

---

## Componentes a Implementar

### 1. Nova Tabela: `visit_schedules` (Agendamentos de Visita)

Campos:
- `id` - UUID
- `company_id` - Empresa
- `frequencia` - semanal/quinzenal/mensal/trimestral
- `proxima_visita` - Data da proxima visita sugerida
- `ultima_visita` - Data da ultima visita realizada
- `motivo` - Preventiva/Corretiva/Acompanhamento
- `prioridade` - alta/media/baixa
- `status` - pendente/agendada/concluida/cancelada
- `ai_justificativa` - Justificativa da IA para a sugestao
- `created_at`, `updated_at`

---

### 2. Edge Function: `ai-visit-planner`

Funcionalidades:
- Recebe dados das empresas negligenciadas
- Analisa historico de chamados e atendimentos
- Gera plano de visitas inteligente com:
  - Prioridade baseada em criticidade
  - Sugestao de frequencia ideal
  - Justificativa para cada visita
  - Distribuicao equilibrada ao longo das semanas

**Exemplo de Prompt para IA:**
```text
Voce e um assistente de gestao de TI. Analise os dados das empresas abaixo
e crie um plano de visitas preventivas considerando:

1. Empresas que nunca receberam visita devem ter prioridade ALTA
2. Empresas com muitos chamados precisam de visitas mais frequentes
3. Distribua as visitas ao longo das semanas para evitar sobrecarga
4. Considere a saude geral de cada empresa (health_score)

Dados das empresas:
[JSON com dados de empresas, chamados, ultimo atendimento, health_score]

Retorne um plano estruturado com:
- company_id, proxima_visita, frequencia, prioridade, justificativa
```

---

### 3. Edge Function CRON: `check-visit-schedule`

Executa diariamente e:
1. Verifica visitas pendentes para hoje/amanha
2. Envia notificacao push para administradores
3. Cria alertas no dashboard
4. Atualiza status de visitas atrasadas

**Notificacoes:**
- "Lembrete: Visita preventiva em CENTER MALHAS agendada para hoje"
- "Alerta: 3 visitas atrasadas esta semana"
- "Sugestao: ROMA DISTRIBUICAO precisa de atencao (90 dias sem visita)"

---

### 4. Novos Componentes UI

**4.1 VisitPlannerCard (no Dashboard Analytics)**
- Botao "Gerar Mapa de Visitas com IA"
- Mostra resumo do plano atual
- Link para calendario de visitas

**4.2 VisitScheduleCalendar**
- Calendario visual com visitas agendadas
- Codigo de cores por prioridade
- Drag-and-drop para reagendar

**4.3 VisitPlanModal**
- Exibe sugestoes da IA
- Permite aprovar/rejeitar cada visita
- Botao para aprovar todas

**4.4 VisitAlertsBanner**
- Barra de alertas no topo do dashboard
- "Voce tem 3 visitas atrasadas"
- "5 empresas sem visita ha mais de 30 dias"

---

## Fluxo de Usuario

```text
1. Admin acessa /analytics
          |
          v
2. Ve card "Clientes Negligenciados" (ja existe)
          |
          v
3. Clica em "Gerar Mapa de Visitas com IA"
          |
          v
4. Sistema envia dados para edge function
          |
          v
5. IA analisa e retorna plano de visitas
          |
          v
6. Modal exibe sugestoes com:
   - Empresa | Proxima Visita | Frequencia | Prioridade | Justificativa IA
          |
          v
7. Admin aprova/ajusta visitas
          |
          v
8. Visitas sao salvas no banco
          |
          v
9. CRON diario envia lembretes automaticos
          |
          v
10. Apos visita, tecnico registra atendimento
           |
           v
11. Sistema atualiza automaticamente proxima visita
```

---

## Detalhes Tecnicos

### Edge Function `ai-visit-planner`

```typescript
// Estrutura basica da edge function
// 1. Buscar empresas negligenciadas e seus dados
// 2. Montar prompt para Lovable AI (Gemini Flash)
// 3. Usar tool calling para extrair dados estruturados
// 4. Retornar plano de visitas em JSON
```

**Tool Calling para Saida Estruturada:**
```json
{
  "type": "function",
  "function": {
    "name": "create_visit_plan",
    "parameters": {
      "visits": [
        {
          "company_id": "uuid",
          "proxima_visita": "2026-02-01",
          "frequencia": "mensal",
          "prioridade": "alta",
          "motivo": "Empresa nunca recebeu visita preventiva",
          "justificativa_ia": "Esta empresa tem 5 chamados abertos..."
        }
      ]
    }
  }
}
```

### CRON para Lembretes

Sera configurado para executar diariamente as 7h:
- Verificar visitas do dia
- Verificar visitas atrasadas
- Enviar notificacoes push

---

## Arquivos a Criar/Modificar

### Novos Arquivos

1. `supabase/functions/ai-visit-planner/index.ts`
   - Edge function que chama Lovable AI
   - Analisa empresas e gera plano

2. `supabase/functions/check-visit-schedule/index.ts`
   - CRON para verificar visitas pendentes
   - Envia alertas e notificacoes

3. `src/components/analytics/VisitPlannerCard.tsx`
   - Card com botao para gerar mapa de visitas
   - Exibe resumo do plano atual

4. `src/components/analytics/VisitPlanModal.tsx`
   - Modal para exibir sugestoes da IA
   - Aprovar/rejeitar visitas

5. `src/components/analytics/VisitCalendar.tsx`
   - Calendario visual de visitas
   - Codigo de cores por prioridade

6. `src/hooks/useVisitSchedule.ts`
   - Hook para gerenciar agendamentos de visita
   - CRUD no banco de dados

### Arquivos a Modificar

1. `src/pages/Analytics.tsx`
   - Adicionar VisitPlannerCard
   - Adicionar VisitAlertsBanner

2. `src/components/analytics/NeglectedCompaniesAlert.tsx`
   - Adicionar botao "Gerar Plano de Visitas"
   - Integrar com modal de planejamento

3. `supabase/config.toml`
   - Adicionar configuracao das novas edge functions

---

## Ordem de Implementacao

### Etapa 1: Infraestrutura (Banco + Edge Function)
1. Criar tabela `visit_schedules`
2. Criar edge function `ai-visit-planner`
3. Testar geracao de plano com IA

### Etapa 2: Interface de Planejamento
4. Criar `VisitPlannerCard`
5. Criar `VisitPlanModal`
6. Integrar com NeglectedCompaniesAlert

### Etapa 3: Visualizacao
7. Criar `VisitCalendar`
8. Adicionar calendario na pagina Analytics

### Etapa 4: Automacao
9. Criar edge function CRON `check-visit-schedule`
10. Configurar alertas e notificacoes push

---

## Beneficios Esperados

1. **Planejamento Inteligente**: IA considera historico e criticidade
2. **Nenhum Cliente Esquecido**: Sistema cobra visitas atrasadas
3. **Visibilidade Total**: Calendario mostra todas as visitas planejadas
4. **Automacao**: Lembretes automaticos via push
5. **Tomada de Decisao**: Justificativas da IA ajudam a priorizar
6. **Reducao de Problemas**: Visitas preventivas evitam chamados reativos

