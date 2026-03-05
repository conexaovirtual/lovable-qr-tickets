import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

import { CompanyList } from '@/components/companies/CompanyList';
import { CompanyDialog } from '@/components/companies/CompanyDialog';

export default function Companies() {
  const navigate = useNavigate();
  const { profile, isAdmin, loading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Verifica se é admin ou técnico
  const canAccess = profile?.roles?.includes('admin_provedor') || profile?.roles?.includes('tecnico');
  const canCreate = canAccess; // Técnicos podem criar
  const canEdit = canAccess; // Técnicos podem editar

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        navigate('/auth');
      } else if (!canAccess) {
        navigate('/dashboard');
      }
    }
  }, [profile, navigate, loading, canAccess]);

  const handleEdit = (company: any) => {
    if (!canEdit) return;
    setEditingCompany(company);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingCompany(null);
  };

  const handleSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading || !profile || !canAccess) {
    return null;
  }

  return (
    <div className="bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Empresas</h1>
              <p className="text-muted-foreground">Gerencie empresas atendidas</p>
            </div>
            {canCreate && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Empresa
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <CompanyList onEdit={handleEdit} refreshTrigger={refreshTrigger} />
      </main>

      <CompanyDialog
        open={dialogOpen}
        onOpenChange={handleClose}
        company={editingCompany}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
