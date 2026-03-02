

## Configurar Cron a cada 5 minutos para lembretes WhatsApp

### Situação Atual
Existem 2 crons configurados:
- `check-service-orders-morning` — roda às 8h (1x/dia)
- `check-service-orders-noon` — roda às 12h (1x/dia)

Isso não é suficiente para o lembrete de 30 minutos antes, que precisa verificar continuamente.

### Plano

1. **Remover os 2 crons antigos** (`jobid 1` e `jobid 2`) via `cron.unschedule`
2. **Criar 1 novo cron** que roda **a cada 5 minutos** (`*/5 * * * *`) chamando a mesma função `check-service-orders-reminder`

Serão 3 comandos SQL executados via insert tool (não migration):
```sql
SELECT cron.unschedule(1);
SELECT cron.unschedule(2);
SELECT cron.schedule('check-service-orders-every-5min', '*/5 * * * *', $$ ... $$);
```

A edge function já está pronta — ela detecta automaticamente se é janela matinal (7h-8h30) ou se há OS nos próximos 30 minutos.

