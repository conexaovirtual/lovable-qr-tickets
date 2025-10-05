import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { CompanyList } from '@/components/companies/CompanyList';
import { CompanyDialog } from '@/components/companies/CompanyDialog';

export default function Companies() {
  const navigate = useNavigate();
  const { profile, isAdmin, loading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        navigate('/auth');
      } else if (!isAdmin()) {
        navigate('/dashboard');
      }
    }
  }, [profile, navigate, isAdmin, loading]);

  const handleEdit = (company: any) => {
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

  if (loading || !profile || !isAdmin()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Empresas</h1>
              <p className="text-muted-foreground">Gerencie empresas atendidas</p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
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
