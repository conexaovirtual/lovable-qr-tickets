import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Plus, Filter } from 'lucide-react';
import { TicketList } from '@/components/tickets/TicketList';
import { TicketFilters } from '@/components/tickets/TicketFilters';
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
  const { profile } = useAuth();
  const [filters, setFilters] = useState({
    status: '',
    prioridade: '',
    categoria: '',
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Chamados</h1>
              <p className="text-muted-foreground">Gerencie todos os chamados técnicos</p>
            </div>
            <div className="flex gap-2">
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
        <TicketList filters={filters} />
      </main>
    </div>
  );
}
