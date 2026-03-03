

## Análise e Sugestões para Melhorar a Usabilidade da IA no WhatsApp

Após analisar sua implementação atual do agente de IA no WhatsApp, identifiquei que o sistema já é bastante robusto — com identificação de cliente, base de conhecimento, criação de chamados, agendamento e escalonamento. O desafio real é fazer o cliente **sentir que está falando com alguém**, não com um bot. Aqui estão as melhorias que sugiro:

---

### 1. Mensagem de Boas-Vindas Humanizada (Quick Win)

**Problema**: O primeiro contato define a percepção. Se parecer robótico, o cliente já cria resistência.

**Solução**: Alterar o prompt do sistema para que a IA se apresente como "assistente da equipe" ao invés de "assistente virtual/IA". Incluir o nome do técnico responsável quando possível.

- No `buildSystemPrompt`, adicionar instrução: "Nunca se apresente como IA, chatbot ou assistente virtual. Diga apenas 'Olá! Aqui é da equipe de suporte da Conexão Virtual'."
- Remover emojis mecânicos (✅ ⚠️) do estilo e usar linguagem mais coloquial.

**Impacto**: Baixo esforço, alto impacto na percepção.

---

### 2. Respostas Mais Curtas e Conversacionais

**Problema**: A IA tende a dar respostas longas e estruturadas (com bullets, listas), que parecem geradas por máquina.

**Solução**: Adicionar regras no prompt para:
- Limitar respostas a 2-3 frases curtas quando possível
- Nunca usar listas com bullets na primeira interação
- Quebrar informações longas em múltiplas mensagens curtas (simular digitação humana)
- Usar linguagem informal-profissional ("beleza", "entendi", "vou verificar pra você")

---

### 3. Delay Simulado de Digitação

**Problema**: Resposta instantânea é o maior indicador de bot. Humanos demoram alguns segundos para digitar.

**Solução**: No `waba-webhook`, antes de chamar o `waba-ai-agent`, adicionar um delay proporcional ao tamanho da resposta (2-5 segundos). Opcionalmente, enviar o indicador "typing" via API do Mabbix antes da resposta.

**Implementação**: Adicionar `await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000))` antes do envio da resposta no agente.

---

### 4. Menu de Ações Rápidas (Botões Interativos)

**Problema**: O cliente não sabe o que pode pedir e fica perdido.

**Solução**: Após identificar o cliente, enviar opções claras:
- "Tenho um problema técnico"
- "Quero saber o status do meu chamado"  
- "Preciso agendar uma visita"
- "Falar com um técnico"

**Implementação**: Se a API Mabbix suportar mensagens com botões/listas (WhatsApp Business API suporta), usar esse formato. Se não, enviar como texto formatado simples.

---

### 5. Proatividade e Follow-up Automático

**Problema**: A IA só reage; não demonstra cuidado proativo.

**Solução**: 
- Após criar um chamado, agendar uma mensagem automática de follow-up (ex: 2h depois): "Oi [nome], tudo bem? Alguma novidade sobre o problema do [equipamento]?"
- Quando um chamado for resolvido pelo técnico, notificar o cliente via WhatsApp automaticamente: "Seu chamado #XXX foi resolvido! Pode confirmar se está tudo ok?"

**Implementação**: Criar uma edge function `waba-followup` acionada por cron ou trigger de atualização de ticket.

---

### 6. Reconhecimento de Contexto Emocional

**Problema**: Quando o cliente está frustrado ("isso nunca funciona!", "de novo?!"), a IA responde de forma genérica.

**Solução**: Adicionar no prompt instruções de empatia contextual:
- Detectar frustração e responder com empatia primeiro ("Entendo sua frustração, vou priorizar isso")
- Detectar urgência e agir mais rápido (escalonar parcialmente de imediato)
- Se o cliente mencionar que é a segunda/terceira vez, reconhecer e priorizar

---

### 7. Integração com Horário Comercial

**Problema**: Se o cliente manda mensagem fora do expediente e recebe resposta imediata da IA, sabe que é bot.

**Solução**: Fora do horário comercial, a IA pode:
- Responder que o time não está disponível, mas registrar o chamado
- Informar o horário de atendimento e quando terá retorno
- Dar uma solução da base de conhecimento se aplicável

**Implementação**: Verificar o horário atual (timezone BRT) no agente e ajustar o comportamento.

---

### Resumo de Prioridades

| Melhoria | Esforço | Impacto |
|---|---|---|
| 1. Boas-vindas humanizadas | Baixo | Alto |
| 2. Respostas curtas | Baixo | Alto |
| 3. Delay de digitação | Baixo | Médio |
| 4. Menu de ações rápidas | Médio | Alto |
| 5. Follow-up automático | Alto | Alto |
| 6. Empatia contextual | Baixo | Médio |
| 7. Horário comercial | Médio | Médio |

### Plano de Implementação

Sugiro implementar em 2 fases:

**Fase 1 (ajustes no prompt + delay)**: Itens 1, 2, 3, 6 — modificações no `waba-ai-agent/index.ts` (prompt e lógica de envio). Sem mudança de banco.

**Fase 2 (novas funcionalidades)**: Itens 4, 5, 7 — nova edge function de follow-up, lógica de horário comercial, e mensagens interativas.

Deseja que eu implemente a Fase 1 primeiro?

