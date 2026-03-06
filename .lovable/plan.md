

## Plano: Finalizar todos os atendimentos em aberto

### Situacao atual

| Tabela | Status | Quantidade |
|---|---|---|
| Tickets | novo | 1 |
| Tickets | em_atendimento | 134 |
| Tickets | aguardando_usuario | 1 |
| Service Orders | agendada | 153 |
| Service Orders | confirmada | 17 |
| Service Orders | em_execucao | 1 |
| Service Orders | finalizada | 12 |
| Daily Service Records | em_andamento | 10 |
| **Total** | | **329 registros** |

### Acoes

Executar 3 comandos SQL (via insert tool) para fechar tudo em massa:

1. **Tickets**: Atualizar todos com status `novo`, `em_atendimento` e `aguardando_usuario` para `fechado`, preenchendo `data_fechamento` e `data_solucao` com `NOW()` onde estiverem nulos.

2. **Service Orders**: Atualizar todas com status `agendada`, `confirmada`, `em_execucao` e `finalizada` para `concluida`, preenchendo `data_execucao` com `NOW()` onde nulo.

3. **Daily Service Records**: Atualizar todos com status `em_andamento` para `concluido`, preenchendo `hora_fim` com a hora atual onde nulo.

### Observacao

Isso e irreversivel. Todos os 329 registros serao marcados como finalizados para que voce possa recomecar o planejamento do zero.

