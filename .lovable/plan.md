

## Criar OS Preventiva Automaticamente (1-Click)

### Problema Atual
O botão "Criar OS Preventiva" apenas navega para um formulário sem preencher corretamente os dados do ativo, empresa e descrição da manutenção sugerida pela IA.

### Solução
Substituir a navegação por uma **criação automática direta** que:
1. Busca o `company_id` do ativo via banco de dados
2. Chama o `smart-scheduler` para obter o próximo slot disponível
3. Cria a OS automaticamente com todos os dados preenchidos (ativo, empresa, descrição da IA, tipo preventivo, modalidade presencial)
4. Exibe toast de confirmação com data/hora agendada

### Mudanças

**`src/components/ai/PredictiveMaintenanceCard.tsx`**:
- Adicionar `company_id` ao interface `Prediction` e ao `loadPredictions` (já vem do join `assets.companies.id`)
- Substituir `handleCreateOS` (que faz navigate) por uma função que:
  1. Busca dados da empresa (endereço, telefone) via `supabase.from('companies')`
  2. Chama `supabase.functions.invoke('smart-scheduler', { body: { modalidade: 'presencial', prioridade: 'media' } })`
  3. Obtém próximo `numero_os` via query
  4. Insere direto em `service_orders` com: `company_id`, `asset_id`, `tipo_servico: 'preventivo'`, `modalidade: 'presencial'`, `status: 'agendada'`, `data_agendada`, `hora_agendada`, `descricao_servicos` com contexto completo da IA
  5. Mostra toast de sucesso com link para a OS ou apenas confirmação
- Adicionar estado `creatingOS` por prediction (para mostrar loading no botão individual)
- Renomear botão para "Criar OS Automática" com ícone de check ao concluir

### Dados que serão preenchidos automaticamente na OS
- Empresa e ativo vinculados
- Tipo: preventivo
- Modalidade: presencial
- Descrição com análise completa da IA (probabilidade, tipo de falha, recomendação, histórico)
- Endereço e telefone da empresa
- Data/hora do próximo slot disponível via smart-scheduler
- Observações com justificativa da IA

