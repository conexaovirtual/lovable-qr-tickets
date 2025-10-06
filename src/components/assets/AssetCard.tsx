import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QrCode, Edit, Package, Building2, Eye, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import QRCode from 'qrcode';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useState } from 'react';

interface AssetCardProps {
  asset: any;
  onEdit: (asset: any) => void;
}

export function AssetCard({ asset, onEdit }: AssetCardProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const canManage = profile?.roles?.some(r => ['admin_provedor', 'tecnico', 'gestor_cliente'].includes(r)) || false;
  const canViewDetails = profile?.roles?.some(r => ['admin_provedor', 'gestor_cliente'].includes(r)) || false;

  const handleViewQR = async () => {
    try {
      const url = `${window.location.origin}/tickets/new?empresa=${asset.company_id}&ativo=${asset.id}&token=${asset.qrcode_token}`;
      const qrDataUrl = await QRCode.toDataURL(url, { width: 512 });
      setQrCodeUrl(qrDataUrl);
      setShowQRModal(true);
    } catch (error) {
      toast({
        title: 'Erro ao gerar QR Code',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `qrcode-${asset.tag_patrimonial || asset.id}.png`;
    link.click();
    
    toast({
      title: 'QR Code baixado',
      description: 'O QR Code foi salvo com sucesso',
    });
  };

  const estadoLabels: Record<string, string> = {
    em_uso: 'Em Uso',
    estoque: 'Estoque',
    manutencao: 'Manutenção',
    baixado: 'Baixado',
  };

  const companyName = asset.company?.nome_fantasia || 'Sem empresa';

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold truncate">{asset.tipo}</span>
              </div>
              <h3 className="font-medium text-sm text-muted-foreground truncate">
                {asset.fabricante || 'Sem fabricante'} {asset.modelo || ''}
              </h3>
              <div className="flex items-center gap-1 mt-1">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate">{companyName}</span>
              </div>
            </div>
            <Badge variant={asset.estado === 'em_uso' ? 'success' : 'secondary'}>
              {estadoLabels[asset.estado] || asset.estado}
            </Badge>
          </div>
        </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-sm">
          {asset.tag_patrimonial && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tag:</span>
              <span className="font-mono">{asset.tag_patrimonial}</span>
            </div>
          )}
          {asset.numero_serie && canViewDetails && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Série:</span>
              <span className="font-mono text-xs">{asset.numero_serie}</span>
            </div>
          )}
          {asset.local && canViewDetails && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Local:</span>
              <span>{asset.local}</span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewQR}
            className="flex-1"
          >
            <QrCode className="h-4 w-4 mr-1" />
            QR Code
          </Button>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(asset)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>

    <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code do Ativo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center p-4 bg-white rounded-lg">
            {qrCodeUrl && (
              <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo:</span>
              <span className="font-medium">{asset.tipo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fabricante:</span>
              <span className="font-medium">{asset.fabricante || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modelo:</span>
              <span className="font-medium">{asset.modelo || 'N/A'}</span>
            </div>
            {asset.tag_patrimonial && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tag:</span>
                <span className="font-mono font-medium">{asset.tag_patrimonial}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Empresa:</span>
              <span className="font-medium">{companyName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado:</span>
              <Badge variant={asset.estado === 'em_uso' ? 'success' : 'secondary'}>
                {estadoLabels[asset.estado] || asset.estado}
              </Badge>
            </div>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setShowQRModal(false)} className="flex-1">
            Fechar
          </Button>
          <Button onClick={handleDownloadQR} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Baixar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
