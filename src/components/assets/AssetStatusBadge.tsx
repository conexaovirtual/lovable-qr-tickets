import { Badge } from '@/components/ui/badge';
import { ShieldCheck, AlertCircle } from 'lucide-react';

interface AssetStatusBadgeProps {
  asset: any;
}

export function AssetStatusBadge({ asset }: AssetStatusBadgeProps) {
  const isUnderWarranty = asset.garantia_fim && new Date(asset.garantia_fim) > new Date();
  const warrantyExpiringSoon = asset.garantia_fim && 
    new Date(asset.garantia_fim) > new Date() &&
    new Date(asset.garantia_fim) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const getStatusVariant = () => {
    switch (asset.estado) {
      case 'em_uso': return 'default';
      case 'estoque': return 'secondary';
      case 'manutencao': return 'outline';
      case 'baixado': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = () => {
    switch (asset.estado) {
      case 'em_uso': return 'Em Uso';
      case 'estoque': return 'Estoque';
      case 'manutencao': return 'Manutenção';
      case 'baixado': return 'Baixado';
      default: return asset.estado;
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <Badge variant={getStatusVariant()}>
        {getStatusLabel()}
      </Badge>

      {isUnderWarranty && !warrantyExpiringSoon && (
        <Badge variant="outline" className="border-green-600 text-green-600">
          <ShieldCheck className="h-3 w-3 mr-1" />
          Garantia
        </Badge>
      )}

      {warrantyExpiringSoon && (
        <Badge variant="outline" className="border-yellow-600 text-yellow-600">
          <AlertCircle className="h-3 w-3 mr-1" />
          Garantia expira em breve
        </Badge>
      )}

      {!isUnderWarranty && asset.garantia_fim && (
        <Badge variant="outline" className="border-red-600 text-red-600">
          Garantia expirada
        </Badge>
      )}
    </div>
  );
}
