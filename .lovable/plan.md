

# Plano: Melhorias no Atendimento Automático por IA do WhatsApp

## Problemas Identificados

1. **Respostas genéricas**: A base de conhecimento é carregada com `LIMIT 10` sem relevância — pega artigos aleatórios, não os mais relevantes para a pergunta do cliente.
2. **Sem contexto de ativos**: A IA não consulta os ativos (equipamentos) da empresa do cliente.
3. **Sem histórico de atendimentos**: A IA não acessa atendimentos diários anteriores para aprender padrões.
4. **Modelo desatualizado**: Usa `gemini-2.5-flash` ao invés de `gemini-3-flash-preview` (mais recente e capaz).
5. **Tools limitadas**: Faltam ferramentas para consultar ativos, listar atendimentos recentes e buscar na base de conhecimento por palavra-chave.
6. **Escalonamento rígido**: Não há opção de escalonamento parcial (ex: encaminhar mas manter IA ativa para acompanhar).
7. **Sem confirmação do cliente**: A IA cria tickets sem pedir confirmação ao cliente.
8. **Sem prioridade inteligente**: Tickets criados pela IA são sempre "novo" sem classificação de urgência.

---

## Implementação

### 1. Context Gathering aprimorado (`waba-ai-agent`)

- Buscar artigos da base de conhecimento **relevantes à mensagem** usando busca por texto (`ilike` nos campos `problema`, `solucao`, `tags`)
- Consultar **ativos da empresa** (últimos 20 ativos com nome, tipo, status)
- Consultar **últimos 10 atendimentos diários** da empresa para contexto histórico
- Consultar **nome do técnico** atribuído aos tickets abertos (join com profiles)

### 2. Novas tools para a IA

- `search_knowledge_base`: Busca artigos por palavra-chave (a IA pode buscar ativamente ao invés de depender do contexto estático)
- `list_company_assets`: Lista ativos da empresa com filtro por tipo/status
- `update_ticket_priority`: Permite a IA classificar urgência/impacto ao criar tickets
- `add_ticket_comment`: Permite a IA adicionar comentários de follow-up a tickets existentes

### 3. System Prompt melhorado

- Adicionar contexto de ativos e histórico de atendimentos
- Instruir IA a **confirmar com o cliente** antes de criar tickets
- Instruir IA a **classificar urgência** baseada nos sintomas
- Adicionar fluxo de escalonamento gradual: primeiro tenta resolver, depois sugere ticket, só escalona se necessário
- Instruir IA a usar `search_knowledge_base` proativamente

### 4. Ticket creation inteligente

- Ao criar ticket, incluir campos `impacto` e `urgencia` baseados na análise da IA
- Vincular o `contact_name` do WhatsApp como `solicitante_nome`
- Tentar identificar o ativo mencionado na conversa e vincular ao ticket

### 5. Upgrade do modelo

- Mudar de `gemini-2.5-flash` para `gemini-3-flash-preview`

### 6. Fluxo de escalonamento melhorado

- Novo tool `partial_escalate`: Notifica técnico mas mantém IA ativa como copiloto
- Ao escalonar, a IA envia resumo estruturado do problema para o técnico (contexto, tentativas, classificação)

---

## Arquivos a editar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/waba-ai-agent/index.ts` | Reescrever `gatherContext`, `buildSystemPrompt`, `getTools`, `handleToolCalls`; upgrade modelo |

Nenhuma migração de banco necessária — todas as tabelas já existem.

