

# Correção: Planejador de Visitas IA - Erro ao Salvar

## Problema Identificado

O sistema não consegue finalizar o mapa de visitas porque a função `mapPrioridade` no hook `useVisitSchedule.ts` está mapeando incorretamente os valores de prioridade:

| Prioridade da Visita | Valor Enviado | Valores Aceitos na Tabela |
|---------------------|---------------|---------------------------|
| alta | **urgente** ❌ | alta, media, baixa |
| media | media ✓ | alta, media, baixa |
| baixa | baixa ✓ | alta, media, baixa |

O valor "urgente" **não existe** na tabela `service_orders`, causando erro ao tentar criar as ordens de serviço automaticamente.

---

## Solução

Corrigir a função `mapPrioridade` para mapear corretamente os valores:

### Arquivo: `src/hooks/useVisitSchedule.ts`

**Antes:**
```typescript
const mapPrioridade = (visitPriority: string): string => {
  switch (visitPriority) {
    case 'alta': return 'urgente';  // ❌ ERRO - valor inválido
    case 'media': return 'media';
    case 'baixa': return 'baixa';
    default: return 'media';
  }
};
```

**Depois:**
```typescript
const mapPrioridade = (visitPriority: string): string => {
  switch (visitPriority) {
    case 'alta': return 'alta';     // ✓ Corrigido
    case 'media': return 'media';
    case 'baixa': return 'baixa';
    default: return 'media';
  }
};
```

---

## Fluxo Corrigido

```text
1. Usuário gera mapa de visitas via IA
2. Modal abre com lista de empresas sugeridas
3. Usuário seleciona visitas e marca "Criar OSs automaticamente"
4. Ao clicar "Salvar":
   a. Sistema cria service_orders com prioridade correta (alta/media/baixa)
   b. Sistema cria visit_schedules vinculadas às OSs
5. Toast de sucesso: "X visitas agendadas e Y ordens de serviço criadas"
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useVisitSchedule.ts` | Linha 108: mudar `'urgente'` para `'alta'` |

---

## Validação

Após a correção, ao salvar o plano de visitas:
- As ordens de serviço serão criadas com status "agendada"
- A prioridade será mapeada corretamente (alta → alta, media → media, baixa → baixa)
- As visitas aparecerão no calendário de OSs

