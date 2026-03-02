import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';

interface AssetLabelPrintProps {
  assets: Array<{
    id: string;
    nome: string;
    local?: string | null;
    company?: { nome_fantasia?: string; logo_url?: string | null } | null;
  }>;
  onClose: () => void;
}

const WHATSAPP_NUMBER = '5562984515801';

export function AssetLabelPrint({ assets, onClose }: AssetLabelPrintProps) {
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generateQRCodes = async () => {
      const codes: Record<string, string> = {};
      for (const asset of assets) {
        const message = `[ASSET:${asset.id}] Suporte: ${asset.nome}${asset.local ? ` - ${asset.local}` : ''}`;
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        codes[asset.id] = await QRCode.toDataURL(url, {
          width: 200,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        });
      }
      setQrCodes(codes);
    };
    generateQRCodes();
  }, [assets]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const labelsHtml = assets.map(asset => {
      const logoUrl = asset.company?.logo_url || '/logo-conexaovirtual.png';
      const qr = qrCodes[asset.id] || '';
      return `
        <div class="label">
          <img src="${logoUrl}" class="logo" alt="Logo" onerror="this.src='/logo-conexaovirtual.png'" />
          <div class="asset-name">${asset.nome}</div>
          ${asset.local ? `<div class="asset-local">${asset.local}</div>` : ''}
          ${qr ? `<img src="${qr}" class="qr" alt="QR Code" />` : ''}
          <div class="footer">Escaneie para suporte via WhatsApp</div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiquetas de Ativos</title>
        <style>
          @page {
            size: 50mm 50mm;
            margin: 2mm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .label {
            width: 46mm;
            height: 46mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 1.5mm;
            page-break-after: always;
            overflow: hidden;
          }
          .label:last-child {
            page-break-after: auto;
          }
          .logo {
            max-width: 20mm;
            max-height: 7mm;
            object-fit: contain;
          }
          .asset-name {
            font-size: 7pt;
            font-weight: 700;
            text-align: center;
            line-height: 1.1;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .asset-local {
            font-size: 6pt;
            color: #555;
            text-align: center;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .qr {
            width: 22mm;
            height: 22mm;
          }
          .footer {
            font-size: 4.5pt;
            color: #666;
            text-align: center;
          }
        </style>
      </head>
      <body>${labelsHtml}</body>
      </html>
    `);

    printWindow.document.close();
    
    // Wait for images to load before printing
    const images = printWindow.document.querySelectorAll('img');
    let loaded = 0;
    const totalImages = images.length;
    
    if (totalImages === 0) {
      printWindow.print();
      return;
    }
    
    images.forEach(img => {
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= totalImages) {
          setTimeout(() => printWindow.print(), 200);
        }
      };
      // If already loaded
      if (img.complete) {
        loaded++;
        if (loaded >= totalImages) {
          setTimeout(() => printWindow.print(), 200);
        }
      }
    });
  };

  const allReady = Object.keys(qrCodes).length === assets.length;

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div ref={printRef} className="flex flex-wrap gap-4 justify-center">
        {assets.map(asset => (
          <div
            key={asset.id}
            className="w-[188px] h-[188px] border rounded-lg flex flex-col items-center justify-between p-2 bg-white text-black"
          >
            <img
              src={asset.company?.logo_url || '/logo-conexaovirtual.png'}
              alt="Logo"
              className="max-w-[75px] max-h-[26px] object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logo-conexaovirtual.png'; }}
            />
            <div className="text-[9px] font-bold text-center leading-tight line-clamp-2">
              {asset.nome}
            </div>
            {asset.local && (
              <div className="text-[7px] text-gray-500 text-center truncate max-w-full">
                {asset.local}
              </div>
            )}
            {qrCodes[asset.id] && (
              <img src={qrCodes[asset.id]} alt="QR" className="w-[83px] h-[83px]" />
            )}
            <div className="text-[5px] text-gray-400 text-center">
              Escaneie para suporte via WhatsApp
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
        >
          Fechar
        </button>
        <button
          onClick={handlePrint}
          disabled={!allReady}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          🖨️ Imprimir Etiquetas
        </button>
      </div>
    </div>
  );
}
