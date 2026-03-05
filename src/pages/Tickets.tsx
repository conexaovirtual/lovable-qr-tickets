import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Plus, Filter, List, Columns3 } from 'lucide-react';
import { TicketList } from '@/components/tickets/TicketList';
import { TicketKanban } from '@/components/tickets/TicketKanban';
import { TicketFilters } from '@/components/tickets/TicketFilters';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
    <div className="bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Chamados</h1>
              <p className="text-muted-foreground">Gerencie todos os chamados técnicos</p>
            </div>
            <div className="flex items-center gap-2">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(val) => val && setViewMode(val as 'list' | 'kanban')}
                className="border rounded-md"
              >
                <ToggleGroupItem value="kanban" aria-label="Kanban" className="px-3">
                  <Columns3 className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="Lista" className="px-3">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>

              {viewMode === 'list' && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
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
                <Button onClick={() => navigate('/tickets/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Chamado
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {viewMode === 'kanban' ? (
          <TicketKanban />
        ) : (
          <TicketList filters={filters} />
        )}
      </main>
    </div>
  );
}
