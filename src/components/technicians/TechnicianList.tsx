import { TechnicianCard } from './TechnicianCard';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface TechnicianListProps {
  technicians: any[];
  loading: boolean;
  onRefresh: () => void;
}

export function TechnicianList({ technicians, loading, onRefresh }: TechnicianListProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (technicians.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          Nenhum técnico cadastrado
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {technicians.map((technician) => (
        <TechnicianCard 
          key={technician.id} 
          technician={technician}
          onUpdate={onRefresh}
        />
      ))}
    </div>
  );
}
