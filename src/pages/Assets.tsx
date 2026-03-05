import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Plus, Package } from 'lucide-react';
import { AssetList } from '@/components/assets/AssetList';
import { AssetDialog } from '@/components/assets/AssetDialog';
import { PageHeader } from '@/components/layout/PageHeader';

export default function Assets() {
  const navigate = useNavigate();
  const { profile, hasRole, isAdmin, loading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!loading && !profile) navigate('/auth');
  }, [profile, navigate, loading]);

  const canManageAssets = isAdmin() || hasRole('tecnico') || hasRole('gestor_cliente');

  const handleEdit = (asset: any) => {
    setEditingAsset(asset);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingAsset(null);
  };

  const handleSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) return null;

  return (
    <div className="bg-background min-h-screen">
      <PageHeader
        icon={Package}
        title="Ativos"
        subtitle="Gerencie equipamentos e patrimônio"
        actions={
          canManageAssets ? (
            <Button
              onClick={() => setDialogOpen(true)}
              size="sm"
              className="h-8 text-xs gap-1 bg-white/10 hover:bg-white/20 text-white border-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo Ativo</span>
            </Button>
          ) : undefined
        }
      />

      <main className="container mx-auto px-4 py-4">
        <AssetList onEdit={handleEdit} refreshTrigger={refreshTrigger} />
      </main>

      <AssetDialog
        open={dialogOpen}
        onOpenChange={handleClose}
        asset={editingAsset}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
