import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ServiceOrderCreateDialog } from '@/components/service-orders/ServiceOrderCreateDialog';

export default function ServiceOrderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(true);

  const ticketId = searchParams.get('ticketId');
  const companyId = searchParams.get('companyId');
  const assetId = searchParams.get('assetId');

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
      onSuccess={() => {
        navigate('/service-orders');
      }}
    />
  );
}
