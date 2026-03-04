

## Plano: Transformar a IA Interna em Assistente Pessoal com Ações no Sistema

### Situação Atual

A IA interna do sistema (`ai-support-chat`) é apenas um chat conversacional simples -- ela responde perguntas mas **não executa nenhuma ação** no sistema. Já o agente de WhatsApp (`waba-ai-agent`) possui 15+ ferramentas integradas (criar chamados, consultar agenda, criar OS, cadastrar ativos, etc.) com acesso completo ao banco de dados.

### O Que Será Feito

Transformar a IA interna em uma **assistente pessoal do técnico/admin** que pode executar ações reais no sistema por comando de voz ou texto. Basicamente, trazer o mesmo motor de ferramentas do WhatsApp para dentro do sistema, adaptado para o contexto do usuário logado.

---

### Fase 1 -- Edge Function com Tool Calling

**Arquivo:** `supabase/functions/ai-support-chat/index.ts` (reescrever)

- Adicionar autenticação do usuário (extrair `user_id` do token JWT)
- Novo system prompt orientado a "assistente pessoal do gestor/técnico"
- Adicionar `tools` e `tool_choice: "auto"` na chamada ao AI Gateway
- Implementar loop multi-round de tool calls (igual ao `waba-ai-agent`, até 3 rounds)
- Ferramentas iniciais:
  - `check_agenda` -- consultar agenda de hoje ou data específica
  - `create_service_order` -- criar OS com Smart Scheduler
  - `create_ticket` -- abrir chamado
  - `list_tickets` -- listar chamados abertos (filtro por empresa, status)
  - `update_ticket_status` -- atualizar status de chamado
  - `search_knowledge_base` -- buscar na base de conhecimento
  - `list_companies` -- listar empresas
  - `list_assets` -- listar ativos de uma empresa
- Cada ferramenta executa queries no banco via Supabase client com service role
- Resposta continua sendo streaming SSE (texto final da IA após processar tools)

### Fase 2 -- Frontend com Voz e UI Melhorada

**Arquivo:** `src/pages/AISupportChat.tsx` (atualizar)

- Integrar o `VoiceInputButton` existente para entrada por voz
- Enviar token de autenticação do usuário logado nas requisições
- Adicionar sugestões rápidas contextuais ("Qual minha agenda de hoje?", "Criar OS para...", "Chamados abertos")
- Manter streaming de resposta existente

**Arquivo:** `src/lib/ai-support-chat.ts` (atualizar)

- Incluir token JWT do usuário logado no header `Authorization`

### Fase 3 -- Contexto Enriquecido

- A edge function busca automaticamente o perfil do usuário, sua role e empresa
- Injeta agenda do dia e chamados pendentes no system prompt
- A IA sabe quem é o usuário e pode agir em nome dele

---

### Detalhes Técnicos

**Streaming com Tool Calls:** O streaming SSE só é possível na resposta final (texto). Durante o processamento de tools, a edge function faz chamadas síncronas internas e só retorna o stream quando a IA gera a resposta textual final. Isso já funciona no `waba-ai-agent`.

**Segurança:** O `user_id` vem do JWT validado no edge function. Todas as ações são executadas com o contexto do usuário logado, respeitando as permissões existentes.

**Estimativa:** 3 etapas de implementação, sendo a Fase 1 a mais complexa (reescrever a edge function com ~800 linhas).

