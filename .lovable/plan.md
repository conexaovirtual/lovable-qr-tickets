

# Plano: Tipagem de Clientes - Contrato vs Eventual

## Resumo

Adicionar um campo de **tipo de contrato** na tabela de empresas para diferenciar entre:

1. **Cliente Eventual** - Atendido apenas sob demanda (quando abre chamado)
2. **Cliente de Contrato** - Obrigatoriedade de visitas preventivas mensais

Apenas os **clientes de contrato** aparecerao no planejador de visitas da IA.

---

## Alteracoes no Banco de Dados

### Nova Coluna: `tipo_contrato`

Adicionar na tabela `companies`:

| Campo | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| tipo_contrato | ENUM | 'eventual' | Tipo de contrato do cliente |

Valores do ENUM:
- `eventual` - Cliente eventual (sem obrigacao de visitas)
- `contrato_manutencao` - Cliente com contrato de manutencao mensal

---

## Alteracoes na Interface

### 1. Formulario de Empresa (`CompanyDialog.tsx`)

Adicionar um novo campo de selecao com duas opcoes:

```text
+----------------------------------+
| Tipo de Contrato                 |
| [x] Cliente Eventual             |
|     Atendido apenas sob demanda  |
|                                  |
| [ ] Contrato de Manutencao       |
|     Visitas preventivas mensais  |
+----------------------------------+
```

Posicionar logo apos o campo "Status" ou na mesma linha.

### 2. Card de Empresa (`CompanyCard.tsx`)

Exibir um badge indicando o tipo de contrato:

```text
+---------------------------+
|  🏢 CENTER MALHAS        |
|  [Eventual]  [Ativo]     |   <- Badge de tipo + status
|  ...                      |
+---------------------------+

ou

+---------------------------+
|  🏢 TECHTRONIC           |
|  [Contrato] [Ativo]      |   <- Badge azul/primario para contrato
|  ...                      |
+---------------------------+
```

### 3. Lista de Empresas (`CompanyList.tsx`)

Opcao de filtro por tipo de contrato:

```text
Filtrar: [Todos ▼] [Eventual] [Contrato]
```

---

## Alteracoes no Hook de Analytics

### `useAnalyticsData.ts`

Modificar a query de empresas para incluir o campo `tipo_contrato`:

```typescript
const { data: companies } = await supabase
  .from('companies')
  .select('id, nome_fantasia, status, tipo_contrato')
```

Adicionar ao tipo `CompanyHealth`:

```typescript
export interface CompanyHealth {
  // ... campos existentes
  tipo_contrato: 'eventual' | 'contrato_manutencao';
}
```

Modificar a lista de empresas negligenciadas para filtrar APENAS clientes de contrato:

```typescript
// Apenas empresas COM CONTRATO que precisam de visita
const neglected = companyHealthArray.filter(c => 
  c.tipo_contrato === 'contrato_manutencao' && 
  c.dias_sem_visita >= NEGLIGENCE_DAYS_THRESHOLD
);
```

---

## Alteracoes no Planejador de Visitas

### `VisitPlannerCard.tsx`

O card automaticamente mostrara apenas empresas de contrato pois o filtro sera aplicado no hook `useAnalyticsData`.

Atualizar o texto informativo:

```text
"A IA analisará apenas os clientes de contrato e sugerirá 
datas e frequências ideais para visitas preventivas."
```

### Edge Function `ai-visit-planner`

Atualizar o prompt da IA para enfatizar que sao clientes de contrato:

```text
"Estas são empresas com CONTRATO DE MANUTENÇÃO que exigem 
visitas preventivas mensais obrigatórias..."
```

---

## Alteracoes no Schema de Validacao

### `validations.ts`

Adicionar o campo ao schema de empresa:

```typescript
export const companySchema = z.object({
  // ... campos existentes
  tipo_contrato: z.enum(['eventual', 'contrato_manutencao'])
    .default('eventual'),
});
```

---

## Resumo de Arquivos

### Novos
- Migracao SQL para adicionar `tipo_contrato`

### Modificados
1. `src/lib/validations.ts` - Adicionar campo no schema
2. `src/components/companies/CompanyDialog.tsx` - Campo de selecao
3. `src/components/companies/CompanyCard.tsx` - Badge de tipo
4. `src/components/companies/CompanyList.tsx` - Filtro opcional
5. `src/hooks/useAnalyticsData.ts` - Filtrar por tipo contrato
6. `src/components/analytics/VisitPlannerCard.tsx` - Texto atualizado
7. `supabase/functions/ai-visit-planner/index.ts` - Prompt atualizado

---

## Fluxo de Uso

```text
1. Admin cadastra empresa
          |
          v
2. Seleciona tipo: Eventual ou Contrato
          |
          v
3. Empresa aparece na lista com badge indicativo
          |
          v
4. Na pagina Analytics:
   - Empresas EVENTUAIS: NAO aparecem como negligenciadas
   - Empresas de CONTRATO: Aparecem se >30 dias sem visita
          |
          v
5. Ao clicar "Gerar Mapa de Visitas":
   - IA analisa APENAS empresas de contrato
   - Gera plano de visitas preventivas
```

---

## Beneficios

1. **Foco no que importa**: Somente clientes de contrato geram alertas
2. **Reducao de ruido**: Clientes eventuais nao poluem o planejador
3. **Clareza visual**: Badge mostra rapidamente o tipo de cliente
4. **Obrigatoriedade**: Sistema cobra visitas apenas onde e obrigatorio
5. **Flexibilidade**: Facil mudar cliente de eventual para contrato

---

## Detalhes Tecnicos

### Migracao SQL

```sql
-- Criar enum para tipo de contrato
CREATE TYPE company_contract_type AS ENUM ('eventual', 'contrato_manutencao');

-- Adicionar coluna na tabela companies
ALTER TABLE companies 
ADD COLUMN tipo_contrato company_contract_type 
DEFAULT 'eventual' NOT NULL;

-- Comentario explicativo
COMMENT ON COLUMN companies.tipo_contrato IS 
  'Tipo de contrato: eventual (sob demanda) ou contrato_manutencao (visitas mensais)';
```

### Interface do Formulario

O campo sera implementado como RadioGroup ou Select com labels claros:

- **Cliente Eventual**: "Atendemos apenas quando solicitado"
- **Contrato de Manutencao**: "Visitas preventivas obrigatorias"

### Logica de Filtragem

No `useAnalyticsData.ts`, a linha que filtra empresas negligenciadas mudara de:

```typescript
// ANTES
const neglected = companyHealthArray.filter(c => c.dias_sem_visita >= 30);

// DEPOIS
const neglected = companyHealthArray.filter(c => 
  c.tipo_contrato === 'contrato_manutencao' && 
  c.dias_sem_visita >= 30
);
```

Isso garante que apenas clientes de contrato aparecam no alerta e no planejador de visitas.

