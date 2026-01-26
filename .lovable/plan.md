
# Plano: Abertura de Chamado e Anotacoes por Comando de Voz com Tipificacao IA

## Resumo

Implementar funcionalidade de **comando de voz** para:
1. **Abrir chamados** falando - a IA transcreve e categoriza automaticamente
2. **Adicionar anotacoes/comentarios** em chamados existentes por voz
3. Funciona em **celular** (campo) e **computador** (escritorio)

---

## Arquitetura da Solucao

```text
+-------------------+     +------------------------+     +------------------+
| Botao Microfone   |---->| Web Speech API         |---->| Texto Transcrito |
| (UI Component)    |     | (Navegador)            |     |                  |
+-------------------+     +------------------------+     +------------------+
                                                                 |
                                                                 v
                                                    +------------------------+
                                                    | Edge Function          |
                                                    | ai-ticket-categorizer  |
                                                    +------------------------+
                                                                 |
                                                                 v
                                                    +------------------+
                                                    | Lovable AI       |
                                                    | (Gemini Flash)   |
                                                    +------------------+
                                                                 |
                                                                 v
                                                    +------------------+
                                                    | Categoria + Sub  |
                                                    | Impacto + Urgencia|
                                                    | Titulo Sugerido  |
                                                    +------------------+
```

---

## Componentes a Implementar

### 1. Hook: `useVoiceInput`

Hook reutilizavel para captura de voz usando a **Web Speech API** nativa do navegador:

- Funciona em Chrome, Edge, Safari (desktop e mobile)
- Transcricao em tempo real (streaming)
- Suporte a portugues brasileiro (pt-BR)
- Feedback visual enquanto escuta
- Estados: idle, listening, processing, error

### 2. Componente: `VoiceInputButton`

Botao de microfone reutilizavel:

- Icone de microfone que muda para indicar gravacao
- Animacao pulsante enquanto escuta
- Feedback de transcricao em tempo real
- Compativel com mobile (toque longo para gravar)

### 3. Edge Function: `ai-ticket-categorizer`

Analisa o texto falado e extrai:

- **Titulo** sugerido (resumo curto)
- **Categoria** mais adequada (Hardware, Software, Rede, Acesso)
- **Subcategoria** especifica
- **Impacto** (baixo, medio, alto)
- **Urgencia** (baixa, media, alta)
- **Descricao** formatada/melhorada

**Categorias disponiveis no sistema:**
- Acesso (Email, VPN)
- Hardware (Desktop, Notebook, Impressora, Monitor)
- Rede (Cabeada, Wi-Fi)
- Software (Antivirus, Office, Sistema Operacional)

---

## Fluxo de Uso - Abertura de Chamado

```text
1. Tecnico acessa /tickets/new
          |
          v
2. Clica no botao de microfone ao lado do campo "Titulo"
          |
          v
3. Fala: "Computador da Maria do financeiro nao liga,
          tela preta, ja verifiquei a tomada e esta ok"
          |
          v
4. Sistema transcreve em tempo real
          |
          v
5. Ao finalizar, envia para IA analisar
          |
          v
6. IA retorna:
   - Titulo: "Desktop nao liga - tela preta"
   - Categoria: Hardware > Desktop
   - Impacto: Alto
   - Urgencia: Alta
   - Descricao: "Computador da Maria (Financeiro) nao liga.
                 Sintoma: tela preta. Verificacoes: tomada OK."
          |
          v
7. Formulario e preenchido automaticamente
          |
          v
8. Tecnico revisa e confirma/ajusta
```

---

## Fluxo de Uso - Anotacoes no Cliente

```text
1. Tecnico chega no cliente
          |
          v
2. Acessa detalhes do chamado no celular
          |
          v
3. Na area de comentarios, clica no microfone
          |
          v
4. Fala: "Chegando no cliente, vou verificar o cabo
          de forca e testar a fonte"
          |
          v
5. Comentario e adicionado automaticamente
          |
          v
6. Depois: "Problema resolvido, era a fonte queimada,
            substitui por uma nova 500W"
          |
          v
7. Comentario com solucao e registrado
```

---

## Detalhes Tecnicos

### Web Speech API

A API nativa do navegador sera usada para transcricao:

```typescript
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'pt-BR';
recognition.continuous = true;
recognition.interimResults = true;

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  // Exibir em tempo real
};
```

**Compatibilidade:**
- Chrome (desktop/Android): Suportado
- Edge: Suportado
- Safari (iOS): Suportado
- Firefox: Limitado (pode requerer fallback)

### Edge Function: `ai-ticket-categorizer`

Usara Lovable AI (Gemini Flash) com tool calling para saida estruturada:

```typescript
const tools = [{
  type: "function",
  function: {
    name: "categorize_ticket",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        categoria: { 
          type: "string", 
          enum: ["Acesso", "Hardware", "Rede", "Software"] 
        },
        subcategoria: { type: "string" },
        impacto: { 
          type: "string", 
          enum: ["baixo", "medio", "alto"] 
        },
        urgencia: { 
          type: "string", 
          enum: ["baixa", "media", "alta"] 
        },
        descricao_formatada: { type: "string" }
      }
    }
  }
}];
```

---

## Arquivos a Criar

### Novos Arquivos

1. **`src/hooks/useVoiceInput.ts`**
   - Hook para gerenciar Web Speech API
   - Estados: idle, listening, processing
   - Callbacks: onTranscript, onFinalResult, onError

2. **`src/components/ui/VoiceInputButton.tsx`**
   - Botao reutilizavel com icone de microfone
   - Animacao pulsante durante gravacao
   - Feedback visual de transcricao

3. **`supabase/functions/ai-ticket-categorizer/index.ts`**
   - Edge function que chama Lovable AI
   - Analisa texto e retorna categorizacao
   - Usa tool calling para saida estruturada

### Arquivos a Modificar

1. **`src/pages/NewTicket.tsx`**
   - Adicionar botao de voz ao lado do campo Titulo
   - Integrar com categorizacao automatica
   - Mostrar loading durante analise da IA

2. **`src/components/tickets/TicketComments.tsx`**
   - Adicionar botao de voz ao lado do Textarea
   - Permitir adicionar comentarios por voz

3. **`src/components/tickets/QuickTicketDialog.tsx`**
   - Adicionar entrada por voz no dialog rapido

4. **`supabase/config.toml`**
   - Adicionar configuracao da nova edge function

---

## Interface do Usuario

### Botao de Microfone

```text
+------------------------------------------+
| Titulo *                      [🎤]       |
+------------------------------------------+
| [________________Campo de texto________] |
+------------------------------------------+

Estado Normal:     🎤 (cinza)
Estado Gravando:   🔴 (vermelho pulsante)
Estado Processando: ⏳ (spinner)
```

### Feedback de Transcricao

```text
+------------------------------------------+
| 🔴 Ouvindo...                            |
| "Computador da Maria do financeiro..."   |
+------------------------------------------+
```

### Resultado da IA

```text
+------------------------------------------+
| ✨ IA Sugeriu:                           |
|                                          |
| Titulo: Desktop nao liga - tela preta    |
| Categoria: Hardware > Desktop            |
| Impacto: Alto | Urgencia: Alta          |
|                                          |
| [Aceitar Sugestao] [Editar Manualmente]  |
+------------------------------------------+
```

---

## Experiencia Mobile

Para uso no campo com celular:

1. **Touch amigavel**: Botao grande de microfone
2. **Feedback haptico**: Vibracao ao iniciar/parar
3. **Tela sempre ligada**: Durante gravacao
4. **Modo offline**: Transcricao local (quando disponivel)

---

## Ordem de Implementacao

### Etapa 1: Infraestrutura
1. Criar hook `useVoiceInput`
2. Criar componente `VoiceInputButton`
3. Testar transcricao basica

### Etapa 2: Categorizacao por IA
4. Criar edge function `ai-ticket-categorizer`
5. Integrar com Lovable AI (Gemini Flash)
6. Testar categorizacao

### Etapa 3: Integracao - Abertura de Chamado
7. Adicionar voz em `NewTicket.tsx`
8. Preenchimento automatico do formulario
9. UI de confirmacao das sugestoes

### Etapa 4: Integracao - Comentarios
10. Adicionar voz em `TicketComments.tsx`
11. Adicionar voz em `QuickTicketDialog.tsx`

---

## Beneficios Esperados

1. **Agilidade**: Abrir chamado em segundos falando
2. **Precisao**: IA categoriza corretamente
3. **Mobilidade**: Funciona no celular em campo
4. **Documentacao**: Anotacoes mais detalhadas por voz
5. **Hands-free**: Util quando maos ocupadas
6. **Padronizacao**: IA formata descricoes consistentes

---

## Consideracoes de Seguranca

- Transcricao ocorre no navegador (Web Speech API)
- Texto enviado para IA apenas para categorizacao
- Nenhum audio e armazenado
- Requer permissao do microfone (usuario autoriza)
