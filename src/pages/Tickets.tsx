import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Plus, Filter, List, Columns3, Ticket } from 'lucide-react';
import { TicketList } from '@/components/tickets/TicketList';
import { TicketKanban } from '@/components/tickets/TicketKanban';
import { TicketFilters } from '@/components/tickets/TicketFilters';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function Tickets() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [filters, setFilters] = useState({
    status: '',
    prioridade: '',
    categoria: '',
    canal: '',
    viaQRCode: '',
  });

  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'qrcode') {
      setFilters(prev => ({ ...prev, viaQRCode: 'true', status: 'novo' }));
      setViewMode('list');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/auth');
    }
  }, [authLoading, profile, navigate]);

  if (authLoading) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 w-full animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <PageHeader
        icon={Ticket}
        title="Chamados"
        subtitle="Gerencie todos os chamados técnicos"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'kanban' ? 'bg-primary text-white shadow-sm' : 'text-white/60 hover:text-white'
                }`}
              >
                <Columns3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'text-white/60 hover:text-white'
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>

            {viewMode === 'list' && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10">
                    <Filter className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filtros</SheetTitle>
                    <SheetDescription>
                      Filtre os chamados por status, prioridade e categoria
                    </SheetDescription>
                  </SheetHeader>
                  <TicketFilters filters={filters} setFilters={setFilters} />
                </SheetContent>
              </Sheet>
            )}

            {profile && (
              <Button
                onClick={() => navigate('/tickets/new')}
                size="sm"
                className="h-8 text-xs gap-1 bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Novo Chamado</span>
              </Button>
            )}
          </div>
        }
      />

      <main className="container mx-auto px-4 py-4">
        {viewMode === 'kanban' ? (
          <TicketKanban />
        ) : (
          <TicketList filters={filters} />
        )}
      </main>
    </div>
  );
}
