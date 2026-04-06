

## Plano: Cadastro Rápido de Ativo na Tela de Atendimento

### Problema
Ao abrir um atendimento para empresas eventuais (como Hexa Tecnologia), se não existem ativos cadastrados, o técnico precisa sair da tela, ir em Ativos, cadastrar e voltar. Isso quebra o fluxo de trabalho.

### Solução
Adicionar um botão "Cadastrar Ativo" ao lado do seletor de ativos no `DailyServiceRecordDialog`. Ao clicar, abre um mini-formulário inline (ou um dialog simplificado) com apenas os campos essenciais:
- **Nome** (hostname/identificação)
- **Tipo** (desktop, notebook, impressora, roteador, etc.)

O ativo é criado como **Manual** (sem vínculo Datto) e automaticamente selecionado no formulário.

### Implementação

**1. Criar componente `QuickAssetDialog`**
- Novo arquivo: `src/components/assets/QuickAssetDialog.tsx`
- Dialog compacto com apenas: Nome, Tipo (select com os tipos existentes)
- Recebe `companyId` como prop
- Ao salvar, insere na tabela `assets` com `datto_device_uid = null`, `datto_device_id = null`
- Retorna o ID do ativo criado via callback `onSuccess(assetId)`

**2. Modificar `DailyServiceRecordDialog.tsx`**
- Importar `QuickAssetDialog`
- Adicionar botão "+ Novo Ativo" ao lado do select de ativos (visível quando uma empresa está selecionada)
- Ao criar o ativo com sucesso: recarregar lista de ativos da empresa e selecionar automaticamente o novo ativo no formulário
- O badge "Manual" já aparecerá nas listagens graças à implementação anterior

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/assets/QuickAssetDialog.tsx` | Novo — dialog simplificado de cadastro rápido |
| `src/components/daily-records/DailyServiceRecordDialog.tsx` | Botão "+ Novo Ativo" + integração com QuickAssetDialog |

### Resultado
O técnico poderá cadastrar ativos diretamente na tela de atendimento sem perder o contexto. Os ativos criados assim serão marcados como "Manual" e protegidos da sincronização Datto.

