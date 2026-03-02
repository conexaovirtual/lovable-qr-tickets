

## Duas mudanças solicitadas

### 1. Técnico José Pereira como responsável em todas as OS automáticas

O `PredictiveMaintenanceCard.tsx` já cria OS automaticamente, mas **não define `tecnico_id`** na inserção. Os webhooks (datto, waba) já usam o ID correto (`e336e78e-...`).

**Mudança**: Adicionar `tecnico_id: 'e336e78e-c11a-48b5-8d69-2bb48cf6bb3b'` no insert de `service_orders` dentro do `handleCreateOS` do `PredictiveMaintenanceCard.tsx` (linha 183).

---

### 2. Etiquetas para app Niimbot B1

O app Niimbot B1 importa etiquetas como **imagem PNG**. Atualmente o sistema gera etiquetas via HTML para impressão no navegador, o que não funciona com o app da Niimbot.

**Mudança**: Adicionar botão "Exportar PNG" no `AssetLabelPrint.tsx` que:
- Renderiza a etiqueta 50x50mm (aprox. 591x591px a 300dpi) em um `<canvas>` invisível
- Desenha: logo da empresa, nome do ativo, local, QR Code, rodapé
- Exporta como arquivo `.png` para download
- O usuário então importa o PNG no app da Niimbot para imprimir

**Arquivo**: `src/components/assets/AssetLabelPrint.tsx`
- Nova função `handleExportPNG` que usa Canvas API
- Canvas 591x591px, fundo branco
- Desenha logo (topo), nome do ativo (centralizado, negrito), local, QR code (centro), texto rodapé
- `canvas.toBlob()` → download como `etiqueta-{tag ou id}.png`
- Botão "📲 Exportar para Niimbot" ao lado do botão "Imprimir"

