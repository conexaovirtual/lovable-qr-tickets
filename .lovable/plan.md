## Diagnóstico

Hoje a IA está calibrada como "técnico humano cordial" (waba-ai-agent linhas ~512–696), mas com 3 fatores que causam a reclamação:

1. **Contexto pesado no prompt** — toda mensagem recebe chamados abertos, ativos, agenda do dia, visitas e atendimentos recentes. O modelo "vê" tudo isso e tenta usar (ex: cliente manda "bom dia" e ela já comenta um chamado em aberto).
2. **`tool_choice: "auto"` + permissão para inferir** — o agente é incentivado a agir sem confirmar ("INFIRA dados quando possível", "Use find_company direto SEM perguntar").
3. **Formato de 1–2 frases** que ainda permite "reconhecimento + pergunta + ação" na mesma mensagem.

Você escolheu: **Super objetiva** / **Só cumprimentar quando o cliente cumprimentar** / **Perguntar antes de inferir**. O plano abaixo aplica isso de forma cirúrgica, sem mexer em ferramentas/integrações que já funcionam (chamados, OS, escalonamento, Mabbix, PIX).

## Mudanças

### 1. Reescrever o prompt do sistema (`buildSystemPrompt`)

Substituir as seções de princípio, identidade, formato, empatia, primeira interação e regras com novo equilíbrio "super objetiva, anti-iniciativa":

- **Princípio central:** "Responda APENAS o que o cliente perguntou. Nunca traga assunto novo. Nunca antecipe. Uma frase é o suficiente na maioria dos casos."
- **Formato:** 1 frase por padrão; 2 só se o cliente fez uma pergunta que exige. Sem reconhecimento performático ("entendi, deixa eu verificar") — vai direto à resposta/pergunta única.
- **Regra de cumprimento isolado:** Se a mensagem do cliente for só saudação ("oi", "bom dia", "boa tarde", "tudo bem?", emoji, "tá aí?"), a resposta é EXATAMENTE: `"{Saudação por horário}, {nome}! Como posso ajudar?"` (ou versão sem nome se não identificado). Proibido citar chamados, agenda, ativos, OS ou contexto nessa primeira resposta.
- **Anti-adivinhação:** Remover instruções "INFIRA quando possível" e "use find_company SEM perguntar". Substituir por: "Nunca execute ferramenta sem o cliente ter pedido explicitamente o que aquela ferramenta resolve. Em dúvida, pergunte uma frase curta."
- **Sem trazer contexto não solicitado:** Adicionar regra explícita: "Você tem acesso a chamados, ativos, agenda e histórico do cliente. NUNCA mencione esses dados a menos que o cliente PERGUNTE sobre eles especificamente."
- **Empatia:** Reduzir a "responda curto e objetivo, sem reconhecimento decorativo". Manter apenas reconhecimento de frustração explícita.
- **Confirmação antes de ação:** Reforçar que `create_ticket`, `create_schedule`, `find_company`, `link_contact`, `register_asset` só rodam após o cliente pedir/confirmar de forma clara.

### 2. Encolher o contexto entregue ao modelo

Em `gatherContext` (linhas 261–436) o conteúdo continua sendo coletado (precisamos dele para quando o cliente perguntar), mas em `buildSystemPrompt` os blocos pesados passam a ficar sob um rótulo "DISPONÍVEL SOB CONSULTA — não cite sem ser perguntado":

- Chamados abertos, ativos, atendimentos recentes, visitas e agenda do dia passam a ser apresentados como referência silenciosa, com prefixo "[Use somente se o cliente perguntar especificamente]".
- Limites menores: chamados abertos top 5 (era 10), ativos top 8 (era 20), atendimentos recentes top 3 (era 10).
- Saudação por horário e empresa/contato continuam visíveis (são identidade, não conteúdo).

### 3. Calibração da chamada à AI

- Manter `tool_choice: "auto"` (precisa para PIX, escalonamento, etc.) mas adicionar no prompt: "Em mensagens com até 3 palavras ou só saudação, NÃO chame ferramenta nenhuma — só responda a saudação."
- Adicionar instrução de auto-revisão antes de enviar: "Reveja sua resposta: ela introduz algum assunto novo que o cliente não pediu? Se sim, reescreva enxugando."

### 4. Atualizar a memória de estilo

Atualizar `mem://features/whatsapp-ai-agent-identity-and-style` para refletir a Versão 4 (super objetiva, anti-iniciativa, cumprimento isolado responde só cumprimento). Manter o histórico das versões anteriores como referência.

### 5. Validação em produção

Após deploy:
- Eu mesmo disparo 2 testes via `supabase--curl_edge_functions` simulando inbound:
  - "bom dia" → deve responder só "Bom dia! Como posso ajudar?" sem citar nada.
  - "qual o status do meu chamado?" → deve perguntar o número ou listar (comportamento legítimo, pois foi perguntado).
- Você observa as próximas 5–10 conversas reais. Se ainda achar verbosa, o próximo ajuste é reduzir contexto a quase zero e forçar `tool_choice: "none"` em mensagens curtas.

## Arquivos afetados

- `supabase/functions/waba-ai-agent/index.ts` — reescrever `buildSystemPrompt` (~512–696) e ajustar limites em `gatherContext` (~363–397).
- `mem://features/whatsapp-ai-agent-identity-and-style` — versão 4.

## O que NÃO muda

- Nenhuma ferramenta é removida (PIX, escalonamento, criação de chamado, OS, agenda continuam iguais).
- Mabbix, webhook, deduplicação, transcrição de áudio, notificações ao José: intactos.
- Reativação automática da IA após 30min de silêncio do humano: intacta.
- Fluxo do QR Code de etiqueta: intacto.

## Riscos

- Risco de "fria demais" volta à mesa. Mitigação: o tom continua com "Bom dia, {nome}! Como posso ajudar?" — humano básico, só sem se adiantar. Se reclamarem de frieza de novo, próximo passo é liberar 1 confirmação cordial após resolução ("Pronto, anotado. Mais alguma coisa?").
- Cliente que escreve só "bom dia" e espera que a IA puxe assunto: minoria, e exatamente o que você quer eliminar.