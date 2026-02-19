

# Analise do Sistema e Plano de Expansao da IA

## Estado Atual da IA no Sistema

O sistema ja possui 7 modulos de IA integrados:

| Modulo | Onde atua | Funcao |
|--------|-----------|--------|
| Categorizador por Voz | Abertura de chamado | Preenche titulo, categoria, impacto e urgencia |
| Triagem IA | Detalhe do chamado (novo/triagem) | Sugere prioridade, tecnico e tickets similares |
| Resumo Automatico | Fechamento de ticket/atendimento | Gera analise executiva |
| Assistente Diagnostico | Ticket em atendimento | Chat com passos de troubleshooting |
| Alertas Inteligentes | Dashboard | Notificacoes proativas de risco |
| Previsao de Manutencao | Dashboard | Prediz falhas em ativos |
| Planejador de Visitas | Analytics | Sugere agendamento de visitas |

## Lacunas Identificadas

Apos analise detalhada do fluxo de abertura e atendimento, identifiquei **5 oportunidades** de alto impacto:

---

### 1. Sugestao de Solucao por IA (ao resolver chamado)

**Problema:** Quando o tecnico muda o status para "Resolvido", o campo de solucao e em branco. O tecnico precisa digitar tudo manualmente.

**Solucao:** Criar uma funcao backend `ai-solution-suggester` que analisa a descricao do chamado, historico de tickets similares resolvidos e dados do ativo para sugerir um texto de solucao pre-preenchido. Um botao "Sugerir Solucao com IA" aparecera ao lado do campo solucao no componente `TicketStatusUpdate`.

**Impacto:** Reduz tempo de documentacao em ~60%, melhora a qualidade dos registros.

---

### 2. Base de Conhecimento Automatica (Knowledge Base)

**Problema:** Tickets resolvidos ficam "enterrados" no historico. Quando um problema semelhante aparece, o tecnico precisa buscar manualmente.

**Solucao:** Criar uma nova pagina `/knowledge-base` com tabela `knowledge_articles` que armazena artigos gerados automaticamente pela IA ao fechar tickets. Uma funcao backend `ai-knowledge-generator` extrai o problema, a solucao e tags do ticket resolvido e cria um artigo pesquisavel. Na abertura de novos chamados, o sistema exibira automaticamente artigos relevantes.

**Impacto:** Acelera resolucao de problemas recorrentes, permite autoatendimento.

---

### 3. IA no Fechamento de Atendimento Diario

**Problema:** O `ServiceOrderExecutionDialog` e os atendimentos diarios nao tem nenhuma assistencia de IA ao documentar a execucao.

**Solucao:** Adicionar botao "Gerar Relatorio com IA" no dialog de execucao de OS e no fechamento de atendimentos diarios. A IA analisa o titulo, descricao, tempo gasto e fotos anexadas para gerar uma descricao profissional da execucao.

**Impacto:** Documentacao padronizada e completa em todos os atendimentos.

---

### 4. Enriquecimento Inteligente de Alertas Datto

**Problema:** Alertas do Datto RMM chegam com mensagens tecnicas brutas (ex: "Security Threat detected") sem contexto util para o tecnico.

**Solucao:** Modificar a funcao `datto-rmm-webhook` para chamar a IA e enriquecer o alerta antes de criar o ticket. A IA traduzira a mensagem tecnica em descricao clara, sugerira acoes imediatas e classificara a severidade real baseada no contexto do ativo e historico.

**Impacto:** Tickets do Datto ja nascem com informacoes uteis, reduzindo tempo de triagem.

---

### 5. Resposta Automatica Inteligente para Chamados via QR Code

**Problema:** Quando um usuario externo abre um chamado via QR Code, ele so recebe confirmacao generica. Nao ha orientacao imediata.

**Solucao:** Apos criar o ticket publico, a IA analisa a descricao e gera uma resposta automatica com passos preliminares que o usuario pode tentar (ex: "Enquanto aguarda o tecnico, tente reiniciar o equipamento"). Essa resposta e salva como comentario automatico no ticket.

**Impacto:** Melhora a experiencia do usuario final e pode resolver problemas simples antes do tecnico chegar.

---

## Detalhes Tecnicos

### Novas funcoes backend
- `ai-solution-suggester` - Sugere texto de solucao baseado no contexto do chamado
- `ai-knowledge-generator` - Gera artigos de conhecimento a partir de tickets resolvidos
- `ai-execution-report` - Gera relatorio de execucao para OS e atendimentos
- `ai-auto-response` - Gera resposta automatica para chamados publicos

### Nova tabela
- `knowledge_articles` (id, ticket_id, titulo, problema, solucao, tags, categoria, created_at) com RLS para admins e tecnicos

### Componentes novos/modificados
- `AISolutionSuggester` - Botao + card de sugestao no TicketStatusUpdate
- `KnowledgeBase` - Nova pagina com busca e listagem de artigos
- `KnowledgeArticleCard` - Card de artigo na base de conhecimento
- `AIExecutionReport` - Botao no ServiceOrderExecutionDialog
- Modificacao do `datto-rmm-webhook` para enriquecimento
- Modificacao do fluxo de ticket publico para auto-resposta

### Modelo de IA
Todas as funcoes usarao `google/gemini-3-flash-preview` via Lovable AI Gateway (sem necessidade de chave adicional).

### Ordem de implementacao sugerida
1. Sugestao de Solucao (maior impacto imediato no dia a dia)
2. Base de Conhecimento (valor acumulativo ao longo do tempo)
3. IA na Execucao de OS (padronizacao)
4. Enriquecimento Datto (melhoria da integracao existente)
5. Auto-resposta QR Code (experiencia do usuario final)

