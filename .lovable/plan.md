
# Plano: Criacao Automatica de Ordens de Servico a partir do Plano de Visitas

## Resumo

Apos a IA gerar o plano de visitas, o sistema permitira criar **ordens de servico automaticamente** para cada visita selecionada. Essas OSs serao criadas com:
- Data agendada conforme sugerido pela IA
- Tipo de servico: **Preventivo**
- Status: **Agendada**
- Aparecendo no **calendario de ordens de servico**

O tecnico entao so precisa executar e fechar cada OS quando chegar no cliente.

---

## Fluxo de Uso

```text
1. Admin acessa Analytics
          |
          v
2. Clica "Gerar Mapa de Visitas" no card do planejador
          |
          v
3. IA gera plano com datas e prioridades
          |
          v
4. Modal exibe sugestoes - usuario seleciona quais aprovar
          |
          v
5. [NOVO] Checkbox: "Criar Ordens de Servico para visitas selecionadas"
          |
          v
6. Ao clicar "Salvar", sistema:
   - Salva agendamentos em visit_schedules
   - Cria service_orders para cada visita (se checkbox marcado)
   - Vincula OS ao agendamento
          |
          v
7. OSs aparecem no Calendario de Ordens de Servico
          |
          v
8. Tecnico executa atendimento e fecha cada OS
```

---

## Alteracoes no Banco de Dados

### Nova Coluna: `service_order_id` em visit_schedules

Adicionar referencia opcional a ordem de servico criada:

| Campo | Tipo | Nullable | Descricao |
|-------|------|----------|-----------|
| service_order_id | UUID | SIM | FK para service_orders |

Isso permite rastrear qual OS foi gerada para qual visita planejada.

---

## Alteracoes no Modal de Aprovacao

### `VisitPlanModal.tsx`

Adicionar checkbox para criar OSs automaticamente:

```text
+------------------------------------------------+
|  ✅ Criar Ordens de Servico automaticamente    |
|     Para cada visita selecionada, uma OS       |
|     sera criada e agendada no calendario       |
+------------------------------------------------+
```

Opcao habilitada por padrao para conveniencia.

---

## Alteracoes no Hook useVisitSchedule

### `saveVisitPlan()`

Modificar funcao para:

1. Receber parametro `createServiceOrders: boolean`
2. Para cada visita:
   - Inserir em `visit_schedules`
   - Se `createServiceOrders = true`:
     - Criar `service_order` com tipo "preventivo"
     - Vincular `service_order_id` na visit_schedule
3. Retornar quantidade de OSs criadas

### Dados da OS Criada

Para cada visita, a OS tera:

```typescript
{
  company_id: visit.company_id,
  tipo_servico: 'preventivo',
  prioridade: mapPrioridade(visit.prioridade), // alta->urgente, media->media, baixa->baixa
  descricao_servicos: `Visita preventiva - ${visit.justificativa_ia}`,
  data_agendada: visit.proxima_visita,
  hora_agendada: '09:00', // horario padrao
  status: 'agendada',
  observacoes: `Gerada automaticamente pelo planejador de visitas IA.\n\nJustificativa: ${visit.justificativa_ia}`,
}
```

---

## Atualizacoes de Interface

### 1. VisitPlanModal.tsx

- Adicionar checkbox "Criar Ordens de Servico"
- Adicionar descricao explicativa
- Passar flag para funcao de salvamento
- Mostrar toast com quantidade de OSs criadas

### 2. Badge de OS no card de visita (Opcional)

Apos salvar, cada item pode exibir badge "OS #123" indicando que OS foi criada.

---

## Consulta das OSs no Calendario

As OSs criadas automaticamente aparecerao no `ServiceOrderCalendar`:
- Tipo: Preventivo
- Status: Agendada (azul)
- Data: Conforme sugerido pela IA
- Descricao: Inclui justificativa da IA

O tecnico pode:
1. Ver todas as visitas planejadas no calendario
2. Clicar para ver detalhes
3. Executar o atendimento
4. Fechar a OS registrando o servico realizado

---

## Resumo de Arquivos

### Modificados

1. **Migracao SQL** - Adicionar `service_order_id` em visit_schedules
2. **`src/hooks/useVisitSchedule.ts`** - Logica para criar OSs
3. **`src/components/analytics/VisitPlanModal.tsx`** - Checkbox e feedback

---

## Detalhes Tecnicos

### Migracao SQL

```sql
-- Adicionar coluna para vincular visita com OS criada
ALTER TABLE visit_schedules 
ADD COLUMN service_order_id UUID REFERENCES service_orders(id) ON DELETE SET NULL;

-- Indice para consultas
CREATE INDEX idx_visit_schedules_service_order ON visit_schedules(service_order_id);

-- Comentario
COMMENT ON COLUMN visit_schedules.service_order_id IS 
  'Ordem de servico criada automaticamente para esta visita';
```

### Logica de Criacao de OS

No hook `useVisitSchedule.ts`:

```typescript
const createServiceOrdersForVisits = async (visits: VisitPlan[]) => {
  const serviceOrders = [];
  
  for (const visit of visits) {
    // Buscar endereco da empresa
    const { data: company } = await supabase
      .from('companies')
      .select('endereco, telefone')
      .eq('id', visit.company_id)
      .single();

    // Criar OS
    const { data: os, error } = await supabase
      .from('service_orders')
      .insert({
        company_id: visit.company_id,
        tipo_servico: 'preventivo',
        prioridade: mapPrioridade(visit.prioridade),
        descricao_servicos: `Visita preventiva mensal - ${visit.company_name}`,
        data_agendada: `${visit.proxima_visita}T09:00:00`,
        hora_agendada: '09:00',
        status: 'agendada',
        endereco_atendimento: company?.endereco,
        telefone_contato: company?.telefone,
        observacoes: `Visita gerada pelo Planejador de Visitas IA.\n\nJustificativa: ${visit.justificativa_ia}`,
      })
      .select()
      .single();

    if (os) {
      serviceOrders.push({ visitCompanyId: visit.company_id, osId: os.id });
    }
  }
  
  return serviceOrders;
};
```

### Mapeamento de Prioridade

```typescript
const mapPrioridade = (visitPriority: string) => {
  switch (visitPriority) {
    case 'alta': return 'urgente';
    case 'media': return 'media';
    case 'baixa': return 'baixa';
    default: return 'media';
  }
};
```

---

## Fluxo Completo no Codigo

1. Usuario clica "Salvar X Visitas" com checkbox marcado
2. `handleSave()` chama `saveVisitPlan(visits, { createServiceOrders: true })`
3. Hook executa:
   - Cria OSs em `service_orders` (uma por visita)
   - Insere agendamentos em `visit_schedules` com `service_order_id`
4. Toast exibe: "X visitas agendadas e X ordens de servico criadas!"
5. OSs aparecem no calendario para o tecnico executar

---

## Beneficios

1. **Automacao Total**: IA gera plano, OSs sao criadas automaticamente
2. **Rastreabilidade**: Cada visita fica vinculada a sua OS
3. **Agenda Integrada**: Tecnico ve tudo no calendario de OSs
4. **Cobranca**: Sistema cobra atendimento atraves das OSs agendadas
5. **Fechamento Simples**: Tecnico so precisa executar e fechar

---

## Consideracoes

### Asset ID

A criacao de OS normalmente requer um `asset_id`. Para visitas preventivas geradas automaticamente, temos opcoes:

1. **Criar sem asset** (requer ajuste no schema ou usar null se permitido)
2. **Selecionar primeiro asset da empresa** automaticamente
3. **Deixar tecnico selecionar** ao executar a OS

Recomendacao: Permitir `asset_id` nulo para visitas preventivas gerais, ja que o tecnico pode verificar multiplos equipamentos em uma visita.

### Verificacao do Schema

O campo `asset_id` em `service_orders` ja e nullable (`asset_id: string | null`), entao podemos criar OSs sem especificar um ativo.
