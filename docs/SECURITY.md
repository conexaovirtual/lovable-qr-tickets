# 🔒 Documentação de Segurança - Help Desk TI

## Modelo de Categorias e Subcategorias

### Decisão de Design: Categorias Globais

As categorias e subcategorias são **globalmente compartilhadas** entre todas as empresas do sistema.

#### Justificativa

✅ **Padronização de nomenclatura**
- Facilita análise comparativa entre diferentes empresas
- Permite benchmarking e relatórios consolidados
- Mantém consistência na classificação de chamados

✅ **Facilita relatórios consolidados**
- Relatórios agregados são mais significativos
- Permite análise de tendências do setor
- Simplifica a integração de dados

✅ **Simplifica manutenção**
- Administração centralizada de categorias
- Atualizações refletem em todas as empresas simultaneamente
- Reduz duplicação de dados

✅ **Não contém dados sensíveis**
- Categorias são genéricas (ex: "Hardware", "Software", "Rede")
- Não expõem informações confidenciais das empresas
- Não revelam processos de negócio específicos

#### RLS Policy

```sql
CREATE POLICY "Authenticated users can view categories" 
ON public.categories 
FOR SELECT 
USING (true);
```

Esta política permite que todos os usuários autenticados visualizem as categorias, mas apenas administradores podem criá-las, editá-las ou excluí-las.

### Segregação de Dados por Tabela

| Tabela | Isolamento | Justificativa |
|--------|-----------|---------------|
| ❌ `categories` | Compartilhada | Padronização intencional |
| ❌ `subcategories` | Compartilhada | Padronização intencional |
| ✅ `tickets` | Por `company_id` | Dados sensíveis do cliente |
| ✅ `assets` | Por `company_id` | Dados sensíveis do cliente |
| ✅ `profiles` | Por `company_id` | Dados pessoais (PII) |
| ✅ `companies` | Por `company_id` | Dados de negócio |

---

## Implementações de Segurança

### 1. Validação de Senhas

#### Frontend
- **Biblioteca:** `@zxcvbn-ts/core`
- **Score mínimo:** 3/4 (Boa ou Forte)
- **Bloqueio:** Senhas comuns (123456, password, admin, qwerty)
- **Feedback visual:** Indicador de força em tempo real

#### Validação
```typescript
// src/lib/validations.ts
password: z.string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .refine((password) => {
    const result = zxcvbn(password)
    return result.score >= 3
  }, {
    message: 'Senha fraca. Use maiúsculas, números e caracteres especiais.'
  })
```

### 2. Rate Limiting

#### Login (Edge Function)
- **Limite:** 5 tentativas por minuto por IP
- **Implementação:** Edge Function `auth-with-rate-limit`
- **Armazenamento:** In-memory (Map)
- **Limpeza:** Automática após 1 minuto ou login bem-sucedido

#### Criação de Tickets (Client-Side)
- **Limite:** 1 ticket a cada 10 segundos por usuário
- **Implementação:** Throttling no frontend
- **Feedback:** Toast de aviso ao usuário

### 3. Gestão de Roles

#### Arquitetura
- **Tabela separada:** `user_roles` (previne escalação de privilégios)
- **Security Definer Functions:** `has_role()`, `is_admin()`
- **Enum de Roles:** `admin_provedor`, `gestor_cliente`, `tecnico`, `solicitante`

#### Políticas RLS
Todas as políticas de acesso utilizam as funções `has_role()` e `is_admin()` para verificação de permissões de forma segura.

---

## Checklist de Segurança

### Implementado ✅
- [x] Validação de força de senha (frontend)
- [x] Bloqueio de senhas comuns
- [x] Rate limiting de login (5/min por IP)
- [x] Rate limiting de criação de tickets (1/10s)
- [x] Roles em tabela separada
- [x] RLS em todas as tabelas sensíveis
- [x] Security Definer Functions para verificação de roles
- [x] Auto-confirm email habilitado (desenvolvimento)

### Pendente 🔄
- [ ] Auditoria de segurança (logs de tentativas de login)
- [ ] Validação de formato CNPJ/telefone
- [ ] Validação de schema para campos JSONB
- [ ] Rate limiting no backend (Edge Function para tickets)
- [ ] Proteção contra ataques de timing
- [ ] Monitoramento de acessos suspeitos

---

## OWASP Top 10 Compliance

| Vulnerabilidade | Status | Mitigação |
|----------------|--------|-----------|
| **A01: Broken Access Control** | ✅ Protegido | RLS + Security Definer Functions |
| **A02: Cryptographic Failures** | ✅ Protegido | Supabase Auth (bcrypt) |
| **A03: Injection** | ✅ Protegido | Parameterized queries (Supabase SDK) |
| **A04: Insecure Design** | ✅ Protegido | Roles separados, validações |
| **A05: Security Misconfiguration** | ✅ Protegido | RLS habilitado, auto-confirm apenas dev |
| **A07: Identification Failures** | 🔄 Parcial | Rate limiting implementado, auditoria pendente |

---

## Contato

Para reportar vulnerabilidades de segurança, entre em contato com a equipe de desenvolvimento.

**Última atualização:** 2025-10-05
