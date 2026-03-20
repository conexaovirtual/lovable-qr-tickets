

## Plano: Corrigir instrução da IA para empresas não cadastradas

### O que muda

A IA do WhatsApp, ao identificar que a empresa não é cadastrada, **não vai mais orientar o cliente a ligar ou enviar e-mail**. Em vez disso, vai apenas informar que a empresa não possui cadastro e **continuar o atendimento normalmente** pelo próprio WhatsApp.

### Alteração no arquivo `supabase/functions/waba-ai-agent/index.ts`

**Linha 562** — Atualizar a instrução do fluxo de empresa não identificada:

**De:**
> `se NÃO encontrar, informe educadamente que a empresa não possui cadastro na Conexão Virtual e oriente o cliente a entrar em contato pelo telefone (62) 3932-1212 ou e-mail contato@conexaovirtual.net para realizar o cadastro. NUNCA cadastre empresas automaticamente.`

**Para:**
> `se NÃO encontrar, informe educadamente que a empresa não possui cadastro na Conexão Virtual, mas continue o atendimento normalmente. NUNCA cadastre empresas automaticamente.`

**Linha 571** — Remover "3. Cadastrar empresa nova" da lista de capacidades (já foi removida a ferramenta, falta limpar o prompt).

### Resumo
- 1 arquivo alterado: `supabase/functions/waba-ai-agent/index.ts`
- Redeploy da função após a alteração

