import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QrCode, Edit, Package } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import QRCode from 'qrcode';
import { useToast } from '@/hooks/use-toast';

interface AssetCardProps {
  asset: any;
  onEdit: (asset: any) => void;
}

export function AssetCard({ asset, onEdit }: AssetCardProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const canManage = profile?.roles?.some(r => ['admin_provedor', 'tecnico', 'gestor_cliente'].includes(r)) || false;
  const canViewDetails = profile?.roles?.some(r => ['admin_provedor', 'gestor_cliente'].includes(r)) || false;

  const handleDownloadQR = async () => {
    try {
      const url = `${window.location.origin}/tickets/new?empresa=${asset.company_id}&ativo=${asset.id}&token=${asset.qrcode_token}`;
      const qrDataUrl = await QRCode.toDataURL(url, { width: 512 });
      
      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = `qrcode-${asset.tag_patrimonial || asset.id}.png`;
      link.click();
      
      toast({
        title: 'QR Code baixado',
        description: 'O QR Code foi salvo com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro ao gerar QR Code',
        variant: 'destructive',
      });
    }
  };

  const estadoLabels: Record<string, string> = {
    em_uso: 'Em Uso',
    estoque: 'Estoque',
    manutencao: 'Manutenção',
    baixado: 'Baixado',
  };

  return (
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
            onClick={handleDownloadQR}
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
  );
}
