

## Plano: Restringir envio do PIX (CNPJ) apenas a pedidos explícitos

### Diagnóstico
Hoje o prompt do agente (`supabase/functions/waba-ai-agent/index.ts`) instrui a IA a fornecer o CNPJ `06.906.723/0001-30` como chave PIX sempre que o assunto "PIX" aparece. Como a regra é frouxa, qualquer menção casual à palavra "pix" (ex.: *"o pix não caiu lá"*, *"tem outra forma além do pix?"*, *"meu banco do pix tá fora"*) dispara o envio do CNPJ — expondo o documento da empresa indevidamente.

### Estratégia

Endurecer a regra do PIX no system prompt para que o CNPJ só seja enviado quando o cliente fizer um **pedido explícito e direto** da chave/dados de pagamento.

**Critérios para liberar o envio do CNPJ (todos do tipo "pedido direto"):**
- *"Me passa o pix"*, *"qual o pix de vocês?"*, *"manda a chave pix"*, *"qual a chave pix da empresa?"*
- *"Como faço pra pagar?"*, *"quero pagar via pix"*, *"me envia os dados pra pagamento"*
- *"Qual o CNPJ pra transferir?"*

**Casos onde a IA NÃO deve enviar o CNPJ (mesmo com a palavra "pix" presente):**
- Menções casuais: *"o pix não caiu"*, *"o pix tá fora do ar"*, *"recebi um pix estranho"*
- Perguntas sobre métodos: *"vocês aceitam pix?"* → responder "sim, aceitamos" SEM enviar o CNPJ; só enviar se o cliente pedir em seguida
- Conversas sem relação clara com pagamento ao prestador

**Comportamento padrão quando houver dúvida:**
A IA deve **confirmar a intenção** antes de enviar: *"Você quer fazer um pagamento pra gente? Posso te passar a chave."* — só envia depois do "sim".

### Arquivo a alterar

**`supabase/functions/waba-ai-agent/index.ts`** — na seção do `buildSystemPrompt` que trata de PIX/pagamento, substituir a regra atual por um bloco mais rigoroso:

```
💰 REGRA CRÍTICA — CHAVE PIX / CNPJ
- A chave PIX da empresa é o CNPJ 06.906.723/0001-30 (Conexão Virtual).
- SÓ envie o CNPJ quando o cliente PEDIR EXPLICITAMENTE a chave PIX ou dados pra pagamento.
  Exemplos válidos: "me passa o pix", "qual a chave pix?", "como faço pra pagar?", "me envia os dados pra transferir".
- NUNCA envie o CNPJ se a palavra "pix" aparecer em outro contexto:
  - "o pix não caiu" → é problema técnico do cliente, NÃO mande o CNPJ
  - "vocês aceitam pix?" → responda só "sim, aceitamos" e pergunte se quer os dados
  - menções genéricas a pix em conversa → ignore
- Em caso de dúvida, confirme antes: "Você quer fazer um pagamento? Posso te passar a chave."
- O CNPJ é dado sensível da empresa — proteja como tal.
```

### Memória a atualizar

Atualizar `mem://features/whatsapp-ai-pix-payment-rules` — refinar a regra: CNPJ é enviado **somente sob pedido explícito**, com exemplos de gatilhos válidos vs. menções casuais a ignorar.

### Detalhes técnicos

- Apenas edição de texto do system prompt.
- Sem mudanças em ferramentas, schema, banco, edge functions adicionais ou frontend.
- Após editar, a função `waba-ai-agent` precisa ser redesployada (automático no Lovable).

