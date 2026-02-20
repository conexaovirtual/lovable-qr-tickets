import { useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { ServiceOrderCreateDialog } from '@/components/service-orders/ServiceOrderCreateDialog';

interface LocationState {
  assetId?: string;
  tipo?: string;
  descricao?: string;
}

export default function ServiceOrderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [dialogOpen, setDialogOpen] = useState(true);

  const state = (location.state as LocationState) || {};
  const ticketId = searchParams.get('ticketId');
  const companyId = searchParams.get('companyId');
  const assetId = searchParams.get('assetId') || state.assetId;

  return (
    <ServiceOrderCreateDialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          navigate(ticketId ? `/tickets/${ticketId}` : '/service-orders');
        }
      }}
      preSelectedCompanyId={companyId || undefined}
      preSelectedTicketId={ticketId || undefined}
      preSelectedAssetId={assetId || undefined}
      preSelectedTipoServico={state.tipo}
      preSelectedDescricao={state.descricao}
      onSuccess={() => {
        navigate('/service-orders');
      }}
    />
  );
}
