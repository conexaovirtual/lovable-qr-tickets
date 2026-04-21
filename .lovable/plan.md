

## Plano: Resolver lentidão geral do sistema (causa raiz: `useAuth` duplicado em todo o app)

### Diagnóstico
Os logs do console mostram o `useAuth` rodando **10+ vezes em poucos segundos** apenas para abrir o Dashboard. A razão: o hook é importado em **34 arquivos** e em uma página típica é instanciado por **6 a 10 componentes simultaneamente** (AppLayout, AppSidebar, AppHeader, Dashboard, SmartAlertsPanel, DattoMonitoringPanel, etc.).

Cada instância do hook:
- Cria seu próprio listener `onAuthStateChange` no Supabase
- Chama `supabase.auth.getSession()` independentemente
- Executa **2 queries** ao banco (`profiles` + `user_roles`) — totalizando dezenas de queries redundantes a cada navegação
- Mantém seu próprio `useState`, disparando re-renders em cascata

Resultado: o app fica lento, "trava" no carregamento, e cada clique dispara nova rodada de fetches. Isso também explica re-renders excessivos do Dashboard (que chama o `loadDashboardData` toda vez que `profile` muda de referência).

### Estratégia: transformar `useAuth` em um Context global

Em vez de cada componente buscar o profile sozinho, **um único Provider** mantém o estado de autenticação no topo da árvore e todos os componentes consomem via `useContext`. Resultado: **1 listener, 1 fetch de profile, 1 fetch de roles** — para o app inteiro.

### Mudanças

**1. `src/hooks/useAuth.tsx` — transformar em Context Provider**
- Criar `AuthContext` com `createContext`
- Criar `AuthProvider` que contém toda a lógica atual (listener, fetchUserProfile, signOut, etc.) — executada **uma única vez**
- O hook `useAuth()` passa a ser apenas `useContext(AuthContext)` — não cria mais estado nem dispara fetches
- Memorizar o objeto de retorno com `useMemo` para evitar re-renders desnecessários
- Remover os `console.log` de debug (eles disparam a cada render também)

**2. `src/App.tsx` — envolver o app com `<AuthProvider>`**
- Mover `<AuthProvider>` para dentro do `<BrowserRouter>` (porque `useAuth` usa `useNavigate`)
- Envolver `<Routes>` para que rotas públicas e privadas tenham acesso

**3. Sem mudanças** nos 34 arquivos consumidores — a API do hook (`useAuth()` retornando `{ user, profile, loading, signOut, hasRole, isAdmin, ... }`) permanece idêntica. Eles só passam a consumir do contexto compartilhado.

**4. Pequena otimização extra no `Dashboard.tsx`**
- O `useEffect` depende de `profile` (objeto), o que pode disparar reloads desnecessários. Trocar a dependência para `profile?.id` (string estável). Sem isso, a cada vez que `profile` é setado o Dashboard recarrega TODAS as 13 queries em paralelo.

### Impacto esperado
- **Eliminação de ~90% das queries redundantes** ao banco em cada navegação (de ~26 para ~2 fetches do auth na carga inicial).
- **App responsivo**, sem travamentos ao trocar de página, abrir sidebar ou clicar em diálogos.
- **Menor consumo do plano Lovable Cloud** (menos requests à database).
- **Sem mudanças visuais** — apenas correção de arquitetura interna.

### Detalhes técnicos
- Manter compatibilidade total da API atual do hook (`profile`, `loading`, `hasRole`, `isAdmin`, `signOut`, `isAuthenticated`, `user`, `session`).
- Preservar a lógica de `setTimeout(0)` para evitar deadlock do Supabase no `onAuthStateChange`.
- Memorizar `hasRole` e `isAdmin` com `useCallback` para que componentes que dependem dessas funções não re-renderizem à toa.
- Nenhuma mudança em RLS, edge functions, banco de dados, ou outras telas.
- Nenhuma mudança em dependências (sem novos pacotes).

### Após aplicar
Recarregar a aba (Ctrl+Shift+R) uma vez para limpar o estado anterior. Os logs do console devem mostrar apenas **1** `Fetching profile` por sessão, não dezenas.

