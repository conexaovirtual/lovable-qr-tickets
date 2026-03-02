

## Problema
O download via `<a>.click()` salva o PNG na pasta **Downloads** do celular, mas o app da Niimbot B1 só busca imagens na **Galeria/Fotos**. Precisamos usar a **Web Share API** para permitir que o usuário compartilhe/salve a imagem diretamente na galeria.

## Solução

**Arquivo: `src/components/assets/AssetLabelPrint.tsx`**

Modificar as funções `handleExportPNG` e `handleExportAllPNG`:

1. **Detectar suporte à Web Share API** (`navigator.canShare`)
2. **Se disponível** (celular): usar `navigator.share({ files: [File] })` — isso abre o menu nativo do sistema onde o usuário pode escolher "Salvar na Galeria" ou abrir direto no app da Niimbot
3. **Se não disponível** (desktop): manter o download tradicional via `<a>.click()` como fallback
4. **Converter o blob para `File`** com tipo `image/png` para compatibilidade com a Share API

O fluxo no celular será: clicar "Exportar para Niimbot" → menu nativo aparece → usuário escolhe "Salvar em Fotos" ou compartilha direto com o app Niimbot.

### Detalhes técnicos
- Substituir o bloco `canvas.toBlob` atual por lógica que tenta `navigator.share()` primeiro
- O `File` precisa ter nome com extensão `.png` para o sistema reconhecer como imagem
- Renomear botão para "📲 Salvar para Niimbot" para deixar mais claro

