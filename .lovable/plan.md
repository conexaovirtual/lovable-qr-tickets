
# Plano: Adicionar Comando de Voz aos Atendimentos Diários

## Problema Identificado

A funcionalidade de comando de voz foi implementada para:
- Chamados (Tickets) - NewTicket.tsx, QuickTicketDialog.tsx, TicketComments.tsx
- Ordens de Serviço - ServiceOrderExecutionDialog.tsx, ServiceOrderEditDialog.tsx

Porém **NÃO foi adicionada** aos Atendimentos Diários (DailyServiceRecordDialog.tsx).

---

## Solução

Adicionar o botão de microfone nos campos de texto do formulário de Atendimento Diário:

1. **Título** - Botão de voz ao lado do campo
2. **Descrição do Atendimento** - Botão de voz para ditar a descrição
3. **Solução Aplicada** - Botão de voz para ditar a solução
4. **Observações** - Botão de voz para anotações adicionais

---

## Campos que Receberão Voz

| Campo | Linha | Benefício |
|-------|-------|-----------|
| Título | ~451 | Falar resumo rápido do atendimento |
| Descrição do Atendimento | ~467 | Ditar todo o contexto do problema |
| Solução Aplicada | ~488 | Descrever solução enquanto executa |
| Observações | ~510+ | Notas adicionais por voz |

---

## Alterações no Arquivo

### `src/components/daily-records/DailyServiceRecordDialog.tsx`

1. **Importar componente VoiceInputButton**
```typescript
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
```

2. **Campo Título** - Adicionar wrapper com flex e botão de voz
```text
+------------------------------------------+
| Título *                         [🎤]    |
+------------------------------------------+
| [________________Input________________]  |
+------------------------------------------+
```

3. **Campo Descrição** - Adicionar botão de voz no label
```text
+------------------------------------------+
| Descrição do Atendimento *       [🎤]    |
+------------------------------------------+
| [________________Textarea_____________]  |
+------------------------------------------+
```

4. **Campo Solução** - Adicionar botão de voz
```text
+------------------------------------------+
| Solução Aplicada                 [🎤]    |
+------------------------------------------+
| [________________Textarea_____________]  |
+------------------------------------------+
```

5. **Campo Observações** - Adicionar botão de voz
```text
+------------------------------------------+
| Observações                      [🎤]    |
+------------------------------------------+
| [________________Textarea_____________]  |
+------------------------------------------+
```

---

## Comportamento

Para cada campo com voz:
- Ao clicar no microfone, inicia gravação
- Texto transcrito é **concatenado** ao valor existente
- Permite ditar múltiplas vezes para complementar

Função de callback para cada campo:
```typescript
const handleVoiceTranscript = (field: string, transcript: string) => {
  const currentValue = form.getValues(field) || '';
  form.setValue(field, currentValue ? `${currentValue} ${transcript}` : transcript);
};
```

---

## Experiência do Usuário

O técnico poderá:
1. Abrir novo Atendimento Diário
2. Selecionar empresa e ativo
3. Clicar no 🎤 ao lado do campo Descrição
4. Falar: "Cliente relatou que a impressora não está imprimindo, verificado que o cartucho estava vazio, substituído por novo cartucho"
5. Texto aparece automaticamente no campo
6. Repetir para Solução se necessário

---

## Resumo de Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/daily-records/DailyServiceRecordDialog.tsx` | Importar VoiceInputButton e adicionar aos campos Título, Descrição, Solução e Observações |

---

## Consistência com Outras Telas

Seguindo o mesmo padrão já implementado em:
- TicketComments.tsx
- ServiceOrderExecutionDialog.tsx
- ServiceOrderEditDialog.tsx

Onde o botão de voz fica ao lado do label do campo.
