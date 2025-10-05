import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { AssetList } from '@/components/assets/AssetList';
import { AssetDialog } from '@/components/assets/AssetDialog';

export default function Assets() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!profile) {
      navigate('/auth');
    }
  }, [profile, navigate]);

  const canManageAssets = profile?.role && ['admin_provedor', 'tecnico', 'gestor_cliente'].includes(profile.role);

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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Ativos</h1>
              <p className="text-muted-foreground">Gerencie equipamentos e patrimônio</p>
            </div>
            {canManageAssets && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Ativo
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
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
