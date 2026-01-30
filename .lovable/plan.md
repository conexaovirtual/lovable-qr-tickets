

# Integração Datto RMM - Monitoramento e Tickets Automáticos

## Objetivo
Criar uma integração completa com o Datto RMM que permite:
1. Receber alertas de monitoramento via Webhook
2. Vincular dispositivos do Datto aos ativos cadastrados
3. Criar tickets automaticamente baseados nos alertas
4. Atualizar status dos ativos em tempo real

---

## Arquitetura da Integração

```text
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│   Datto RMM     │────────▶│  Edge Function       │────────▶│   Helpdesk      │
│   (Alertas)     │ Webhook │  datto-rmm-webhook   │         │   (Tickets)     │
└─────────────────┘         └──────────────────────┘         └─────────────────┘
                                      │
                                      ▼
                            ┌──────────────────────┐
                            │   Tabela assets      │
                            │   (datto_device_id)  │
                            └──────────────────────┘
```

---

## 1. Modificações no Banco de Dados

### Tabela `assets` - Novos Campos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `datto_device_id` | text | ID do dispositivo no Datto RMM |
| `datto_device_uid` | text | UID único do dispositivo |
| `datto_site_id` | text | ID do site/cliente no Datto |
| `datto_last_sync` | timestamp | Última sincronização |
| `datto_status` | text | Status atual do dispositivo (online/offline/alert) |

### Nova Tabela `datto_alerts_log`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | ID único |
| `alert_uid` | text | UID do alerta no Datto |
| `device_id` | text | ID do dispositivo |
| `asset_id` | uuid | FK para assets (se vinculado) |
| `ticket_id` | uuid | FK para tickets (se criado) |
| `alert_type` | text | Tipo do alerta (Performance, Hardware, etc.) |
| `alert_category` | text | Categoria |
| `alert_message` | text | Mensagem do alerta |
| `alert_priority` | text | Prioridade |
| `device_hostname` | text | Nome do dispositivo |
| `device_ip` | text | IP do dispositivo |
| `site_name` | text | Nome do site |
| `raw_payload` | jsonb | Payload completo recebido |
| `processed` | boolean | Se já foi processado |
| `created_at` | timestamp | Data de criação |

---

## 2. Edge Function: `datto-rmm-webhook`

### Funcionalidades
- Recebe webhooks do Datto RMM
- Valida token de segurança
- Identifica o ativo correspondente (por `datto_device_id` ou hostname)
- Cria ticket automaticamente se o alerta for crítico
- Atualiza status do ativo
- Envia notificação push para técnicos
- Registra log do alerta

### Payload Esperado (Datto Webhook)
```json
{
  "alertlevel": "triggered",
  "device_id": "123456",
  "device_uid": "abc-123-xyz",
  "device_hostname": "DESKTOP-RECEPCAO",
  "device_ip": "192.168.1.50",
  "device_os": "Windows 10 Pro",
  "device_description": "Desktop Recepção",
  "site_id": "789",
  "site_uid": "site-uid-123",
  "site_name": "Empresa Cliente LTDA",
  "alert_uid": "alert-123",
  "alert_type": "Performance",
  "alert_category": "CPU Usage",
  "alert_message": "CPU usage exceeded 90% for 15 minutes",
  "alert_priority": "critical",
  "platform": "pinotage"
}
```

### Lógica de Criação de Ticket
```text
SE alert_priority = "critical" OU "warning":
  1. Buscar asset por datto_device_id OU hostname
  2. SE asset encontrado:
     a. Obter company_id do asset
     b. Criar ticket com:
        - titulo: "[DATTO] {alert_type}: {device_hostname}"
        - descricao: alert_message + detalhes do dispositivo
        - prioridade: critical→critica, warning→alta, info→media
        - canal: "monitoramento"
        - asset_id: asset vinculado
        - status: "novo"
     c. Atualizar asset.estado para "manutencao" se crítico
     d. Enviar push notification
  3. SE asset NÃO encontrado:
     a. Registrar log para vinculação manual
     b. Criar ai_alert informando dispositivo não cadastrado
```

---

## 3. Componente UI: Vinculação Datto

### AssetDialog.tsx - Nova Seção
Adicionar campos para vincular ativo ao Datto RMM:

```text
┌─────────────────────────────────────────────────────┐
│ 🔗 Integração Datto RMM                             │
├─────────────────────────────────────────────────────┤
│ Device ID: [________________]                        │
│ Site ID:   [________________]                        │
│                                                      │
│ Status: 🟢 Online | Última sync: 15/01/2026 14:30   │
└─────────────────────────────────────────────────────┘
```

---

## 4. Dashboard de Monitoramento (Novo Componente)

### DattoMonitoringPanel.tsx
Exibe status em tempo real dos dispositivos monitorados:

```text
┌─────────────────────────────────────────────────────┐
│ 📊 Monitoramento Datto RMM                          │
├─────────────────────────────────────────────────────┤
│ ✅ 45 Dispositivos Online                           │
│ ⚠️ 3 Alertas Ativos                                 │
│ 🔴 1 Dispositivo Offline                            │
├─────────────────────────────────────────────────────┤
│ Alertas Recentes:                                   │
│ • DESKTOP-01 - CPU 95% (há 5 min) [Ver Ticket]     │
│ • SERVER-DB - Disco 85% (há 15 min) [Ver Ticket]   │
└─────────────────────────────────────────────────────┘
```

---

## 5. Configuração no Datto RMM

### URL do Webhook
```
https://plyzicpwvcqheubiidvn.supabase.co/functions/v1/datto-rmm-webhook
```

### Headers Obrigatórios
```
Authorization: Bearer {DATTO_WEBHOOK_SECRET}
Content-Type: application/json
```

### Payload Template (para configurar no Datto)
```json
{
  "alertlevel": "[alertlevel]",
  "device_id": "[device_id]",
  "device_uid": "[device_uid]",
  "device_hostname": "[device_hostname]",
  "device_ip": "[device_ip]",
  "device_os": "[device_os]",
  "device_description": "[device_description]",
  "site_id": "[site_id]",
  "site_uid": "[site_uid]",
  "site_name": "[site_name]",
  "alert_uid": "[alert_uid]",
  "alert_type": "[alert_type]",
  "alert_category": "[alert_category]",
  "alert_message": "[alert_message]",
  "alert_priority": "[alert_priority]",
  "platform": "[platform]",
  "last_user": "[lastuser]"
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/datto-rmm-webhook/index.ts` | Criar | Endpoint para receber webhooks |
| `src/components/dashboard/DattoMonitoringPanel.tsx` | Criar | Painel de monitoramento |
| `src/components/assets/AssetDialog.tsx` | Modificar | Campos de integração Datto |
| `supabase/config.toml` | Modificar | Registrar nova função |
| Migração SQL | Criar | Novos campos e tabela |

---

## Fluxo Completo

1. **Configuração Inicial**
   - Administrador cadastra ativos com `datto_device_id`
   - Configura webhook no Datto RMM apontando para o endpoint

2. **Alerta Dispara no Datto**
   - Monitor detecta problema (CPU alta, disco cheio, offline)
   - Webhook envia payload para Edge Function

3. **Processamento Automático**
   - Edge Function recebe e valida o alerta
   - Busca ativo correspondente pelo device_id
   - Cria ticket automaticamente se crítico
   - Atualiza status do ativo
   - Envia push notification

4. **Técnico Visualiza**
   - Dashboard mostra painel de monitoramento
   - Ticket aparece na lista com tag "DATTO"
   - Técnico pode resolver remotamente via link do Datto

---

## Segurança

- Token de autenticação (`DATTO_WEBHOOK_SECRET`) obrigatório
- Rate limiting: máximo 100 webhooks/minuto por IP
- Validação do payload antes de processar
- Log de todos os alertas recebidos para auditoria
- RLS nas tabelas para proteger dados

---

## Secret Necessário

| Nome | Descrição |
|------|-----------|
| `DATTO_WEBHOOK_SECRET` | Token para autenticar webhooks do Datto |

