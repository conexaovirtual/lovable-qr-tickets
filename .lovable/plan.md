

## Plano: Adicionar botão de exclusão de empresas

### Contexto
A política RLS `Admins can delete companies` já existe no banco. Falta apenas o botão na interface.

### Alterações

**1. `src/components/companies/CompanyCard.tsx`**
- Adicionar botão "Excluir" (ícone Trash2) ao lado de "Editar"
- Mostrar diálogo de confirmação (AlertDialog) antes de excluir
- Chamar `supabase.from('companies').delete().eq('id', company.id)`
- Após exclusão, chamar `onUpdate()` para recarregar a lista
- Botão visível apenas para admins (passando prop ou verificando role)

**2. `src/components/companies/CompanyCard.tsx` — Props**
- Adicionar prop `canDelete?: boolean` para controlar visibilidade do botão

**3. `src/pages/Companies.tsx`**
- Passar `canDelete` baseado em `isAdmin` para o CompanyList/CompanyCard

**4. `src/components/companies/CompanyList.tsx`**
- Repassar `canDelete` para cada CompanyCard

### Resumo
- 3 arquivos alterados
- Sem migração de banco (RLS já existe)
- Confirmação obrigatória antes de excluir

