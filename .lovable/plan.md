## Problema
`AppLayout.tsx` importa `@/hooks/useTicketAutomation`, mas o arquivo não existe. Isso quebra todas as rotas autenticadas.

## Solução
Criar `src/hooks/useTicketAutomation.ts` com Realtime de tickets + toast para o técnico/admin logado. Atribuição automática ao Jose Pereira fica fora desse hook (deve ser feita no backend via trigger/edge function para não depender do navegador aberto).

## Comportamento
- Só ativa se houver `profile` autenticado.
- Assina canal Postgres Changes em `public.tickets`:
  - `INSERT` → toast "Novo ticket #N — {titulo}".
  - `UPDATE` de `status` → toast "Ticket #N agora: {status}".
- Dedup simples por `id` + timestamp para evitar toast duplicado quando o próprio usuário cria/edita.
- Cleanup do canal no unmount.

## Arquivos
- **Criar** `src/hooks/useTicketAutomation.ts`.

## Detalhes técnicos
- `supabase.channel('ticket-automation').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, handler).subscribe()`.
- Usa `useToast` de `@/hooks/use-toast` e `useAuth` para gate por sessão.
- Ignora eventos cujo `updated_by`/`solicitante_id` seja o próprio usuário (quando aplicável).
- Sem chamadas de escrita — apenas leitura/notificação no cliente.

## Fora de escopo
- Auto-atribuição ao Jose Pereira (recomendo trigger SQL posterior).
- Notificações push / e-mail (já existem edge functions próprias).