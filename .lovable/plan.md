

## Plano: Enriquecer Cadastro de Ativos e Detalhamento de Incidentes Datto

### Problema
Quando o Datto cria ativos automaticamente, eles ficam com informações mínimas (apenas hostname e tipo inferido). Faltam dados de hardware (CPU, RAM, disco, SO) e os incidentes poderiam ter descrições mais completas.

### Solução

**Arquivo: `supabase/functions/datto-rmm-webhook/index.ts`**

1. **Expandir a interface `DattoPayload`** para capturar campos adicionais que o Datto RMM pode enviar no webhook:
   - `device_os`, `platform`, `last_user` (já existem mas não são persistidos no ativo)
   - Campos extras: `device_type`, `device_serial_number`, `device_description`, `intIpAddress`, `extIpAddress`, `domain`, `patchStatus`

2. **Persistir mais dados no ativo criado** (função `autoLinkOrCreateAsset`):
   - Salvar `sistema_operacional` do payload (já faz, mas melhorar)
   - Preencher o campo `configuracoes` (jsonb) com todos os dados de hardware disponíveis do payload
   - Preencher `numero_serie` se o serial vier no payload
   - Preencher `observacoes` com detalhes mais ricos (SO, IP, último usuário, plataforma)

3. **Atualizar ativo existente com dados novos** — quando o webhook encontra um ativo já cadastrado, atualizar campos que estão vazios:
   - Se `sistema_operacional` está null → preencher com `device_os`
   - Se `configuracoes` está null → popular com dados do payload
   - Se `numero_serie` está null e o payload trouxe serial → preencher

4. **Melhorar descrição do incidente/ticket** — na criação do ticket, incluir mais contexto:
   - Plataforma, último usuário logado, IP interno/externo
   - Solicitar à IA uma análise mais detalhada com recomendações específicas por tipo de alerta

5. **Também atualizar `datto-batch-provision`** para aplicar a mesma lógica de enriquecimento quando processar alertas em lote

### Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/datto-rmm-webhook/index.ts` |
| Editar | `supabase/functions/datto-batch-provision/index.ts` |

Nenhuma mudança de banco de dados é necessária — o campo `configuracoes` (jsonb) já existe na tabela `assets` e aceita qualquer estrutura.

