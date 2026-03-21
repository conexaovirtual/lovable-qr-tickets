

## Plano: Simplificar formulário de cadastro de ativos

### O que muda

Remover campos subutilizados e eliminar a aba "Adicionais", movendo "Sistema Operacional" para a aba "Dados Básicos". O formulário fica mais limpo e direto.

### Campos removidos
- Subcategoria
- Estado
- Tag Patrimonial
- Setor
- Data de Compra
- Garantia até
- Aba "Adicionais" inteira

### Campo movido
- **Sistema Operacional** → vai para a aba "Dados Básicos"

### Alterações

**1. `src/components/assets/AssetDialog.tsx`**
- Remover do `formData`: `subcategoria_id`, `estado`, `tag_patrimonial`, `setor`, `data_compra`, `garantia_fim`
- Remover state `subcategories` e o `useEffect` que busca subcategorias
- Remover do formulário os campos visuais de: subcategoria, estado, tag patrimonial, setor
- Remover a aba "Adicionais" (`TabsTrigger` + `TabsContent value="additional"`)
- Adicionar campo "Sistema Operacional" na aba "Dados Básicos" (após Modelo/Número de Série)
- Mover "Observações" para a aba "Dados Básicos"
- Ajustar grid das tabs (menos uma aba)
- Limpar payload no `handleSubmit` (remover campos deletados, manter null para os que ficam no banco)

**2. `src/pages/Inventory.tsx`** — Atualizar filtros e tabela
- Remover filtro de "estado" do painel de filtros
- Remover colunas "Tag" e "Estado" da tabela
- Ajustar colSpan dos placeholders

**3. `src/components/assets/AssetList.tsx`** — Verificar se exibe campos removidos (subcategoria, estado, tag, setor) e remover da visualização

**4. `src/lib/exportInventory.ts`** — Remover campos do CSV/PDF: Tag, Estado, Setor, Data Compra, Garantia

### Resumo
- 4 arquivos alterados
- Sem migração de banco (colunas permanecem, apenas não são mais exibidas/editadas no formulário)

