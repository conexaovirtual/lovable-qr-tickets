

## Etiqueta de Inventário 50x50mm — Implementado ✅

### O que foi feito

1. **Componente `AssetLabelPrint.tsx`** — etiqueta 50x50mm para impressora Niimbot com:
   - Logo da empresa (ou logo padrão Conexão Virtual)
   - Nome do ativo
   - Local do ativo
   - QR Code WhatsApp apontando para `wa.me/5562984515801`
   - Mensagem pré-formatada: `[ASSET:uuid] Suporte: NomeMaquina - Local`

2. **Botão "Imprimir Etiqueta"** (ícone de impressora) no `AssetCard.tsx`

3. **Número atualizado para 5562984515801** em:
   - `datto-rmm-webhook/index.ts` (TECNICO_PHONE)
   - `waba-ai-agent/index.ts` (TECNICO_PHONE)

4. **Detecção de `[ASSET:uuid]`** no `waba-ai-agent`:
   - Reconhece o tag na mensagem recebida
   - Busca dados completos do ativo (nome, tipo, fabricante, modelo, local, etc.)
   - Busca histórico de chamados do ativo (últimos 10)
   - Auto-vincula o contato à empresa do ativo
   - Injeta contexto no system prompt para a IA atender de forma contextualizada
   - Instrui a IA a vincular automaticamente o `asset_id` ao abrir chamado
