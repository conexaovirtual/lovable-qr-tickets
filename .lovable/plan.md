
# Plano Completo: Sistema de IA Inteligente para Helpdesk

## Visao Geral

Este plano implementa 5 modulos de IA que transformarao o helpdesk em uma plataforma inteligente com:

1. **Triagem IA** - Analise automatica de novos tickets
2. **Resumo Automatico** - Geracao de resumos ao fechar atendimentos
3. **Assistente de Diagnostico** - Ajuda durante atendimentos
4. **Alertas Inteligentes** - Notificacoes proativas
5. **Previsao de Manutencao** - Predicao de falhas em ativos

---

## Arquitetura Geral

```text
+------------------+     +--------------------+     +------------------+
|   Frontend       |---->|  Edge Functions    |---->|  Lovable AI      |
|   (React)        |     |  (Deno/Supabase)   |     |  Gateway         |
+------------------+     +--------------------+     +------------------+
                               |
                               v
                        +-------------+
                        |  Database   |
                        |  (Supabase) |
                        +-------------+
```

---

## Modulo 1: Triagem IA de Tickets

### Objetivo
Quando um ticket novo chega (especialmente via QR Code), a IA analisa automaticamente e sugere:
- Prioridade recomendada
- Tecnico ideal baseado em historico
- Tickets similares resolvidos anteriormente

### Componentes

#### 1.1 Edge Function: `ai-ticket-triage`

```text
POST /functions/v1/ai-ticket-triage
Body: { ticket_id: UUID }

Resposta:
{
  prioridade_sugerida: "alta" | "media" | "baixa",
  urgencia_sugerida: "alta" | "media" | "baixa",
  tecnico_sugerido: { id, nome, motivo },
  tickets_similares: [
    { id, titulo, solucao_resumo, similaridade }
  ],
  justificativa: "string"
}
```

#### 1.2 Componente: `AITriageCard`

Card exibido no TicketDetail para tickets novos:
- Botao "Analisar com IA"
- Exibe sugestoes de prioridade
- Lista tickets similares com solucoes
- Botao para aplicar sugestoes

#### 1.3 Fluxo

```text
Ticket Novo (status: novo)
        |
        v
   Admin/Tecnico abre ticket
        |
        v
   Card "Triagem IA" aparece
        |
        v
   Clica "Analisar"
        |
        v
   Edge function consulta:
   - Historico de tickets da empresa
   - Tickets similares (por titulo/descricao)
   - Tecnicos disponiveis e historico
        |
        v
   IA analisa e sugere
        |
        v
   Usuario pode aplicar ou ignorar
```

---

## Modulo 2: Resumo Automatico IA

### Objetivo
Ao fechar um atendimento (daily_service_record ou ticket), gerar automaticamente:
- Resumo executivo do atendimento
- Identificar padroes recorrentes
- Sugerir acoes preventivas

### Componentes

#### 2.1 Edge Function: `ai-service-summary`

```text
POST /functions/v1/ai-service-summary
Body: { 
  service_type: "daily_service" | "ticket",
  service_id: UUID 
}

Resposta:
{
  resumo_executivo: "string (max 200 palavras)",
  problema_identificado: "string",
  solucao_aplicada: "string",
  tempo_estimado_futuro: "string",
  padrao_detectado: boolean,
  recomendacao_preventiva: "string" | null,
  tags_sugeridas: ["rede", "hardware", ...]
}
```

#### 2.2 Integracao no Fechamento

Modificar `DailyServiceRecordDialog` e `TicketStatusUpdate`:

1. Quando status muda para "concluido/resolvido"
2. Botao "Gerar Resumo IA" aparece
3. Ao clicar, chama edge function
4. Exibe resumo em card bonito
5. Usuario pode editar e salvar

#### 2.3 Nova Tabela: `ai_summaries`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | PK |
| source_type | TEXT | 'ticket' ou 'daily_service' |
| source_id | UUID | FK para ticket ou daily_service |
| resumo | TEXT | Resumo gerado |
| padroes | JSONB | Padroes detectados |
| recomendacoes | TEXT | Recomendacoes preventivas |
| created_at | TIMESTAMP | Data de criacao |

---

## Modulo 3: Assistente de Diagnostico IA

### Objetivo
Durante um atendimento ativo, o tecnico pode consultar a IA para:
- Obter passos de diagnostico
- Consultar solucoes de problemas similares
- Receber sugestoes baseadas no tipo de ativo

### Componentes

#### 3.1 Edge Function: `ai-diagnostic-assistant`

```text
POST /functions/v1/ai-diagnostic-assistant
Body: { 
  contexto: {
    ticket_id?: UUID,
    daily_service_id?: UUID,
    asset_id?: UUID,
    descricao_problema: string
  },
  pergunta: string
}

Resposta:
{
  resposta: "string (markdown)",
  passos_diagnostico: [
    { ordem: 1, descricao: "Verificar...", importante: boolean }
  ],
  solucoes_anteriores: [
    { titulo, resumo, data }
  ],
  nivel_confianca: "alto" | "medio" | "baixo"
}
```

#### 3.2 Componente: `AIDiagnosticButton`

Botao flutuante ou card que:
- Aparece em atendimentos ativos
- Abre modal de chat com IA
- Permite perguntas em linguagem natural
- Exibe respostas formatadas em Markdown

#### 3.3 Fluxo

```text
Tecnico em atendimento ativo
        |
        v
   Clica botao "Ajuda IA"
        |
        v
   Modal abre com contexto pre-carregado
   (ativo, empresa, descricao do problema)
        |
        v
   Tecnico pergunta: "O que pode causar lentidao?"
        |
        v
   IA responde com:
   - Passos de diagnostico
   - Historico de casos similares
   - Sugestoes baseadas no tipo de ativo
```

---

## Modulo 4: Alertas Inteligentes

### Objetivo
Sistema proativo que analisa dados e gera alertas sobre:
- Risco de SLA
- Sobrecarga de tecnicos
- Padroes anormais de chamados
- Empresas que precisam de atencao

### Componentes

#### 4.1 Edge Function: `ai-smart-alerts`

Executada periodicamente (cron) ou sob demanda:

```text
POST /functions/v1/ai-smart-alerts
Body: {} (analisa dados automaticamente)

Resposta:
{
  alertas: [
    {
      tipo: "sla_risco" | "tecnico_sobrecarga" | "padrao_anormal" | "empresa_atencao",
      severidade: "alta" | "media" | "baixa",
      titulo: string,
      descricao: string,
      dados: { ... },
      acao_sugerida: string
    }
  ],
  resumo: string
}
```

#### 4.2 Nova Tabela: `ai_alerts`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | PK |
| tipo | TEXT | Tipo do alerta |
| severidade | TEXT | alta/media/baixa |
| titulo | TEXT | Titulo do alerta |
| descricao | TEXT | Descricao detalhada |
| dados | JSONB | Dados relacionados |
| acao_sugerida | TEXT | Acao recomendada |
| lido | BOOLEAN | Se foi visualizado |
| resolvido | BOOLEAN | Se foi tratado |
| created_at | TIMESTAMP | Data de criacao |

#### 4.3 Componente: `SmartAlertsPanel`

Painel no Dashboard que:
- Exibe alertas ativos nao lidos
- Permite marcar como lido/resolvido
- Agrupa por severidade
- Icone de notificacao no header

---

## Modulo 5: Previsao de Manutencao

### Objetivo
Analisar historico de tickets/atendimentos por ativo para:
- Prever falhas nos proximos 30 dias
- Recomendar manutencao preventiva
- Identificar ativos problematicos

### Componentes

#### 5.1 Edge Function: `ai-predictive-maintenance`

```text
POST /functions/v1/ai-predictive-maintenance
Body: { company_id?: UUID } (opcional - todas se omitido)

Resposta:
{
  previsoes: [
    {
      asset_id: UUID,
      asset_nome: string,
      company_nome: string,
      probabilidade_falha: number (0-100),
      tipo_falha_prevista: string,
      dias_estimados: number,
      historico_resumo: string,
      recomendacao: string
    }
  ],
  ativos_criticos: number,
  ativos_atencao: number
}
```

#### 5.2 Componente: `PredictiveMaintenanceCard`

Card no Analytics/Dashboard:
- Lista ativos com risco de falha
- Grafico de probabilidade
- Botao para criar OS preventiva
- Filtro por empresa

#### 5.3 Integracao

- Exibir indicador de risco no card do ativo
- Badge de alerta em ativos problematicos
- Sugerir automaticamente no planejador de visitas

---

## Detalhes Tecnicos

### Banco de Dados - Migracoes SQL

```sql
-- Tabela para resumos IA
CREATE TABLE ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('ticket', 'daily_service')),
  source_id UUID NOT NULL,
  resumo TEXT NOT NULL,
  padroes JSONB,
  recomendacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_summaries_source ON ai_summaries(source_type, source_id);

-- Tabela para alertas inteligentes
CREATE TABLE ai_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  severidade TEXT NOT NULL CHECK (severidade IN ('alta', 'media', 'baixa')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  dados JSONB,
  acao_sugerida TEXT,
  lido BOOLEAN DEFAULT FALSE,
  resolvido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_alerts_tipo ON ai_alerts(tipo);
CREATE INDEX idx_ai_alerts_lido ON ai_alerts(lido, resolvido);

-- Tabela para cache de previsoes
CREATE TABLE ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  probabilidade_falha INTEGER CHECK (probabilidade_falha >= 0 AND probabilidade_falha <= 100),
  tipo_falha_prevista TEXT,
  dias_estimados INTEGER,
  recomendacao TEXT,
  valido_ate TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_predictions_asset ON ai_predictions(asset_id);
CREATE INDEX idx_ai_predictions_validade ON ai_predictions(valido_ate);

-- RLS Policies
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_summaries" ON ai_summaries
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage ai_alerts" ON ai_alerts
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage ai_predictions" ON ai_predictions
  FOR ALL USING (public.is_admin(auth.uid()));
```

### Arquivos a Criar

#### Edge Functions (4 novas)

| Funcao | Arquivo | Descricao |
|--------|---------|-----------|
| ai-ticket-triage | supabase/functions/ai-ticket-triage/index.ts | Triagem automatica |
| ai-service-summary | supabase/functions/ai-service-summary/index.ts | Resumo de atendimento |
| ai-diagnostic-assistant | supabase/functions/ai-diagnostic-assistant/index.ts | Assistente de diagnostico |
| ai-smart-alerts | supabase/functions/ai-smart-alerts/index.ts | Alertas inteligentes |
| ai-predictive-maintenance | supabase/functions/ai-predictive-maintenance/index.ts | Previsao de manutencao |

#### Componentes React (6 novos)

| Componente | Arquivo | Uso |
|------------|---------|-----|
| AITriageCard | src/components/ai/AITriageCard.tsx | TicketDetail |
| AISummaryCard | src/components/ai/AISummaryCard.tsx | Formularios de fechamento |
| AIDiagnosticAssistant | src/components/ai/AIDiagnosticAssistant.tsx | Modal de chat |
| AIDiagnosticButton | src/components/ai/AIDiagnosticButton.tsx | Botao flutuante |
| SmartAlertsPanel | src/components/ai/SmartAlertsPanel.tsx | Dashboard |
| PredictiveMaintenanceCard | src/components/ai/PredictiveMaintenanceCard.tsx | Analytics |

#### Hooks (2 novos)

| Hook | Arquivo | Proposito |
|------|---------|-----------|
| useAITriage | src/hooks/useAITriage.ts | Logica de triagem |
| useSmartAlerts | src/hooks/useSmartAlerts.ts | Buscar/gerenciar alertas |

---

## Cronograma de Implementacao

### Fase 1: Triagem IA (Prioridade Alta)
1. Criar edge function `ai-ticket-triage`
2. Criar componente `AITriageCard`
3. Integrar ao `TicketDetail`

### Fase 2: Resumo Automatico
1. Criar tabela `ai_summaries`
2. Criar edge function `ai-service-summary`
3. Criar componente `AISummaryCard`
4. Integrar ao fechamento de tickets e atendimentos

### Fase 3: Assistente de Diagnostico
1. Criar edge function `ai-diagnostic-assistant`
2. Criar componentes `AIDiagnosticButton` e `AIDiagnosticAssistant`
3. Integrar em telas de atendimento ativo

### Fase 4: Alertas Inteligentes
1. Criar tabela `ai_alerts`
2. Criar edge function `ai-smart-alerts`
3. Criar componente `SmartAlertsPanel`
4. Integrar ao Dashboard com notificacoes

### Fase 5: Previsao de Manutencao
1. Criar tabela `ai_predictions`
2. Criar edge function `ai-predictive-maintenance`
3. Criar componente `PredictiveMaintenanceCard`
4. Integrar ao Analytics e cards de ativos

---

## Resumo de Entregaveis

| Item | Quantidade |
|------|------------|
| Edge Functions | 5 novas |
| Tabelas SQL | 3 novas |
| Componentes React | 6 novos |
| Hooks | 2 novos |
| Modificacoes em telas | 4 (TicketDetail, DailyService, Dashboard, Analytics) |

---

## Beneficios Esperados

1. **Reducao de 40% no tempo de triagem** - IA analisa e sugere automaticamente
2. **Documentacao padronizada** - Resumos automaticos garantem consistencia
3. **Resolucao mais rapida** - Assistente de diagnostico acelera troubleshooting
4. **Prevencao de problemas** - Alertas proativos evitam crises
5. **Manutencao inteligente** - Previsao de falhas reduz downtime
