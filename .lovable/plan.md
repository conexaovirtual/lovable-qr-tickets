

The user wants to humanize the WhatsApp AI agent. Let me check the current system prompt in the WABA AI agent function.
<lov-tool-use id="toolu_vrtx_015XahaMyvXjtn6F56qQwKfm" name="code--exec" integration-id="code" data="{\"command\": \"grep -n \\\"system\\\\|content:\\\\|nome\\\\|empresa\\\\|Olá\\\\|sou \\\" supabase/functions/waba-ai-agent/index.ts | head -80\", \"user_facing_description\": \"Inspecting current WhatsApp AI prompt\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01S5HRF2d5pSCYXrPFNdcEVB" name="code--exec" integration-id="code" data="{\"command\": \"grep -n \\\"system\\\\|content:\\\\|Olá\\\\|sou \\\\|nome\\\\|empresa\\\" supabase/functions/waba-ai-agent/index.ts | head -100\", \"user_facing_description\": \"Inspecting current WhatsApp AI prompt\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EgbFXcAc64PYLqvR5MhhHS" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/waba-ai-agent/index.ts\", \"lines\": \"490-640\"}">
</lov-tool-use>
I have enough context. Let me present the plan.

<lov-plan>

## Plano: Humanizar a abordagem da IA no WhatsApp

### Diagnóstico
O prompt atual (`supabase/functions/waba-ai-agent/index.ts`, linhas 505-562) tem dois problemas principais:

1. **Abordagem inicial fria e burocrática** — a primeira mensagem para clientes não identificados é literalmente "Olá! Suporte Conexão Virtual 😊 / Qual seu nome e empresa?" — soa como formulário e gera o exato problema relatado (clientes não respondem).
2. **Tom ríspido demais** — o prompt proíbe expressões naturais ("beleza", "pode deixar", "deixa comigo"), proíbe emojis, força respostas de "1-2 frases máximo" e exige tom "PROFISSIONAL e COMERCIAL... como atendente bem treinado". Isso produz respostas robóticas tipo "Certo. Vou verificar." sem calor humano.
3. **Menu numérico (1-4)** logo no primeiro contato reforça a sensação de bot/URA.

### Estratégia (nova abordagem humanizada)

**Princípio central:** o cliente nunca deve perceber que está falando com IA. A identificação (nome/empresa) deixa de ser uma pergunta de gatekeeping e passa a ser obtida **organicamente** durante a conversa.

**1. Primeiro contato — cliente NÃO identificado**
- Em vez de pedir nome/empresa de cara, abrir com uma saudação calorosa e **perguntar diretamente como pode ajudar**.
- Exemplo novo: *"Oi! Tudo bem? Aqui é da Conexão Virtual 😊 Em que posso te ajudar hoje?"*
- A IA só pede nome/empresa **depois** que o cliente expõe o problema — e de forma natural: *"Pra eu te ajudar melhor com isso, me conta seu nome e de qual empresa você fala?"* — no meio da conversa, não como bloqueio.
- Se o cliente resistir, a IA continua tentando ajudar com o que conseguir e tenta identificar mais adiante.

**2. Primeiro contato — cliente JÁ identificado**
- Remover o menu numérico 1-4. Substituir por saudação aberta natural.
- Exemplo: *"Oi, ${contactName}! Tudo bem? Como posso te ajudar?"*
- Se em algum momento o cliente pedir opções, aí sim a IA lista verbalmente.

**3. Tom e linguagem (revisão da seção 🎭 IDENTIDADE E TOM)**
- Mudar de "PROFISSIONAL e COMERCIAL / como atendente bem treinado" para **"humano, próximo, prestativo, como um colega da equipe técnica que conhece bem o cliente"**.
- **Liberar** expressões naturais brasileiras: "tranquilo", "pode deixar", "vou dar uma olhada", "já te respondo", "show", "perfeito", "beleza" (com moderação — sem virar gíria de adolescente).
- **Liberar uso ocasional de emojis** (1 por mensagem, no máximo) para suavizar — 😊 👍 ✅ 🙌 — não obrigatório, mas permitido quando soar natural.
- Permitir **frases de transição humanas**: "Deixa eu ver aqui...", "Só um instante que vou consultar", "Anotei aqui", "Boa pergunta".
- Variar abertura — não começar toda resposta igual. Às vezes uma confirmação curta ("Anotado!"), às vezes uma pergunta direta, às vezes uma pequena empatia.

**4. Formato das respostas (revisão da seção 📏)**
- Relaxar o limite rígido de "1-2 frases máximo" para **"curto e conversacional, como mensagem de WhatsApp real"** — pode ter 2-3 frases quando fizer sentido humano (uma de empatia + uma de ação, por exemplo).
- Manter proibição de markdown/listas/bullets (correto para WhatsApp).
- Permitir pequenas confirmações tipo "Show, anotei!" antes da próxima pergunta.

**5. Empatia e rapport**
- Quando o cliente relatar um problema, **reconhecer brevemente antes de partir para ação**: *"Que chato isso 😕 Vou te ajudar. Acontece desde quando?"* — em vez de só "Qual modelo da impressora?".
- Se o cliente parecer impaciente, demonstrar urgência humana: *"Entendi, vou agilizar aqui!"*.

**6. Identificação no meio da conversa (novo fluxo)**
- A ferramenta `find_company` + `link_contact` continua igual.
- Mudança: a IA é instruída a **inferir** dados a partir do que o cliente fala (ex: se ele cita o nome da empresa naturalmente, usar `find_company` sem precisar perguntar formalmente).
- Se passar 2-3 trocas sem identificar, a IA pede de forma leve: *"Aliás, pra eu registrar direitinho, me lembra seu nome e empresa?"*.

### Arquivo a alterar

**`supabase/functions/waba-ai-agent/index.ts`** — reescrever as seções do `buildSystemPrompt` (linhas ~505-562 e 615-624):
- Reescrever bloco "🎭 IDENTIDADE E TOM" → tom humano/próximo, liberando expressões naturais e emojis ocasionais.
- Reescrever bloco "📏 FORMATO DAS RESPOSTAS" → curto e conversacional (não rígido 1-2 frases).
- Reescrever bloco "🎯 PRIMEIRA INTERAÇÃO" → remover menu 1-4, abrir conversa convidando o problema; identificação vira passo natural posterior.
- Adicionar novo bloco "🤝 RAPPORT E EMPATIA" com exemplos de aberturas variadas e reconhecimento do problema.
- Ajustar bloco de fluxo para cliente não identificado: pedir nome/empresa **só depois** que o cliente trouxe o assunto, ou após 2-3 mensagens.

### Memória a salvar
Atualizar `mem://features/whatsapp-ai-agent-identity-and-style` com a nova diretriz (tom humano próximo, identificação postergada, sem menu numérico inicial).

### Detalhes técnicos
- Sem mudanças em ferramentas (tool definitions), schema de banco, ou outras edge functions.
- Sem mudanças no front-end.
- Apenas o texto do system prompt na função `buildSystemPrompt`.
- Modelo continua o mesmo (já ajustado para o agente).

