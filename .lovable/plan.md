
# Plano: Dashboard Analítico Inteligente + IA para Gestão de Chamados

## Resumo Executivo

Este plano transforma seu sistema de help desk em uma plataforma inteligente com:
- **Dashboard Analítico** para visualização clara de problemas e oportunidades
- **Assistente IA** para abertura inteligente de chamados e sugestoes de manutencao
- **Sistema de Alertas** para clientes sem visitas e manutencoes programadas
- **Plano de Manutencao Preventiva** com cobranca automatica

---

## Fase 1: Dashboard Analítico de Gestão

### 1.1 Nova Página: Centro de Comando (`/analytics`)

Criar uma nova pagina dedicada a analise com as seguintes secoes:

**Painel de Saude Geral**
- Indicador de saude do suporte (verde/amarelo/vermelho)
- Taxa de resolucao de chamados
- Tempo medio de resposta
- SLA cumprido vs violado

**Mapa de Problemas por Empresa**
- Lista de empresas ordenada por quantidade de problemas
- Codigo de cores (vermelho = muitos chamados, verde = poucos)
- Tendencia (aumentando/diminuindo/estavel)

**Grafico de Tendencias**
- Chamados criados vs resolvidos por mes
- Comparativo com meses anteriores
- Previsao baseada em historico

**Distribuicao por Categoria**
- Quais tipos de problemas mais ocorrem
- Hardware vs Software vs Rede vs Acesso
- Identificacao de padroes recorrentes

### 1.2 Cards de Insight Rapido

```text
+------------------+  +------------------+  +------------------+
| Empresas em      |  | Chamados sem     |  | SLA em Risco     |
| Alerta           |  | Categoria        |  | (proximas 2h)    |
| 3 empresas       |  | 14 (51%)         |  | 2 chamados       |
+------------------+  +------------------+  +------------------+
```

### 1.3 Alerta de Clientes Negligenciados

Com base nos dados, identificamos empresas que nunca receberam visita:
- CENTER MALHAS
- LOJA ANDREIA DIGITAL
- R E ESTAMPARIA
- ROMA DISTRIBUICAO
- E outras...

Sistema mostrara:
- Lista de empresas sem atendimento ha X dias
- Configuracao de limite (ex: alerta apos 30 dias sem visita)
- Botao para criar OS de manutencao preventiva

---

## Fase 2: Inteligencia Artificial Integrada

### 2.1 Assistente para Abertura de Chamados

**Edge Function: `ai-ticket-assistant`**

Quando um cliente descreve um problema, a IA:
1. Sugere categoria e subcategoria automaticamente
2. Estima prioridade baseada no contexto
3. Identifica se ja existe chamado similar aberto
4. Sugere solucoes conhecidas de chamados anteriores

Exemplo de fluxo:
```text
Cliente: "Computador nao liga depois que faltou energia"

IA analisa e sugere:
- Categoria: Hardware
- Subcategoria: Desktop/Fonte
- Prioridade: Alta (equipamento inoperante)
- Chamados similares: 2 nos ultimos 6 meses
- Sugestao: Verificar fonte de alimentacao e estabilizador
```

### 2.2 Gerador de Plano de Manutencao

**Edge Function: `ai-maintenance-planner`**

A IA analisa o historico de cada empresa e cria plano personalizado:

```text
Entrada: Historico de chamados + ativos da empresa

Saida:
- Frequencia ideal de visitas preventivas
- Equipamentos com maior probabilidade de falha
- Cronograma sugerido para os proximos 3 meses
- Estimativa de reducao de chamados reativos
```

### 2.3 Chatbot de Suporte Interno

Interface de chat onde voce pode perguntar:
- "Quais empresas estao com mais problemas este mes?"
- "Qual tecnico tem melhor tempo de resolucao?"
- "Quais tipos de problemas aumentaram?"
- "Sugestoes para reduzir chamados de hardware?"

---

## Fase 3: Sistema de Manutencao Preventiva

### 3.1 Nova Tabela: `maintenance_schedules`

Campos:
- company_id (empresa)
- asset_id (opcional, ativo especifico)
- frequencia (semanal/quinzenal/mensal/trimestral)
- proxima_visita (data)
- ultima_visita (data)
- tipo (preventiva/corretiva programada)
- descricao
- status (ativo/pausado)

### 3.2 Alertas Automaticos

**Edge Function com CRON: `check-maintenance-due`**

Executa diariamente e:
1. Verifica manutencoes proximas de vencer
2. Envia notificacao push para tecnicos
3. Cria OS automaticamente se configurado
4. Alerta sobre empresas sem visita ha muito tempo

### 3.3 Configuracao por Empresa

Na pagina de cada empresa, nova aba "Plano de Manutencao":
- Frequencia de visitas preventivas
- Equipamentos prioritarios
- Contato para agendamento
- Historico de manutencoes

---

## Fase 4: Melhorias na Gestao de Chamados

### 4.1 Categorizacao Automatica

Quando 51% dos chamados nao tem categoria, a IA pode:
- Sugerir categoria baseada no titulo/descricao
- Auto-categorizar com 1 clique de confirmacao
- Aprender com categorizacoes manuais

### 4.2 Deteccao de Padroes

A IA identifica:
- Problemas recorrentes na mesma empresa
- Equipamentos que dao mais problema
- Horarios de pico de chamados
- Correlacao entre tipos de problema

### 4.3 Priorizacao Inteligente

Fatores considerados:
- SLA da empresa
- Impacto no negocio
- Quantidade de usuarios afetados
- Historico de problemas similares
- Urgencia declarada

---

## Arquitetura Tecnica

### Novas Edge Functions

1. **`ai-ticket-assistant`** - Assistente para abertura de chamados
2. **`ai-maintenance-planner`** - Gerador de plano de manutencao
3. **`ai-analytics-chat`** - Chatbot de analise de dados
4. **`check-maintenance-due`** - Verificador de manutencoes (CRON)

### Novas Tabelas

1. **`maintenance_schedules`** - Agendamentos de manutencao
2. **`ai_suggestions_log`** - Historico de sugestoes da IA
3. **`company_health_scores`** - Pontuacao de saude por empresa

### Novos Componentes React

1. **`src/pages/Analytics.tsx`** - Pagina principal de analise
2. **`src/components/analytics/HealthDashboard.tsx`** - Painel de saude
3. **`src/components/analytics/ProblemHeatmap.tsx`** - Mapa de problemas
4. **`src/components/analytics/TrendCharts.tsx`** - Graficos de tendencia
5. **`src/components/analytics/AIAssistant.tsx`** - Interface do assistente IA
6. **`src/components/maintenance/MaintenancePlanner.tsx`** - Planejador
7. **`src/components/maintenance/AlertsPanel.tsx`** - Painel de alertas

---

## Cronograma de Implementacao

### Semana 1-2: Dashboard Analitico
- Pagina de Analytics
- Cards de metricas
- Graficos de tendencia
- Lista de empresas negligenciadas

### Semana 3-4: Sistema de Manutencao
- Tabela maintenance_schedules
- Interface de configuracao
- Edge function de verificacao
- Alertas automaticos

### Semana 5-6: Integracao IA
- Edge function ai-ticket-assistant
- Edge function ai-maintenance-planner
- Interface de sugestoes
- Categorizacao automatica

### Semana 7-8: Chatbot e Refinamentos
- Edge function ai-analytics-chat
- Interface de chat
- Testes e ajustes
- Documentacao

---

## Beneficios Esperados

1. **Visibilidade Total**: Saber exatamente onde estao os problemas
2. **Decisoes Baseadas em Dados**: Informacoes claras para tomada de decisao
3. **Prevencao de Problemas**: Manutencao preventiva reduz chamados reativos
4. **Nenhum Cliente Esquecido**: Sistema cobra visitas atrasadas
5. **Abertura Inteligente**: IA ajuda a classificar e priorizar chamados
6. **Eficiencia Operacional**: Menos tempo categorizando, mais tempo resolvendo

---

## Proximos Passos Sugeridos

Posso comecar pela implementacao em qualquer ordem, mas recomendo:

1. **Primeiro**: Dashboard Analitico (visibilidade imediata)
2. **Segundo**: Sistema de Alertas de Clientes Negligenciados
3. **Terceiro**: IA para categorização de chamados
4. **Quarto**: Plano de Manutencao Preventiva
5. **Quinto**: Chatbot de analise

Qual parte gostaria de comecar primeiro?
