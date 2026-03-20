

## Plano: Remover permissão de criação de empresas pela IA do WhatsApp

### O que muda

A IA do WhatsApp deixará de cadastrar empresas automaticamente. Quando um contato não for identificado como cliente, a IA informará que a empresa não é cadastrada e orientará a entrar em contato por outro canal.

### Alterações no arquivo `supabase/functions/waba-ai-agent/index.ts`

**1. Remover a ferramenta `register_company`** (linhas ~838-855)
- Excluir a definição da tool `register_company` do array de ferramentas disponíveis para a IA.

**2. Atualizar o prompt do sistema** (linhas ~561-562)
- Onde hoje diz: `"se não, use register_company"`
- Substituir por instrução para informar que a empresa não é cadastrada e que não pode criar cadastros.

**3. Remover o handler `case "register_company"`** (linhas ~1517-1559)
- Remover o bloco de execução que cria a empresa e vincula o contato.

**4. Adicionar instrução explícita no prompt**
- Adicionar regra clara: "NUNCA cadastre empresas. Se o cliente não for identificado após busca com find_company, informe educadamente que a empresa não possui cadastro e oriente a entrar em contato com a Conexão Virtual para realizar o cadastro."

