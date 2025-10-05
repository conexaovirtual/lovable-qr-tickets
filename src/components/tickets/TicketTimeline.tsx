import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketTimelineProps {
  ticketId: string;
}

export function TicketTimeline({ ticketId }: TicketTimelineProps) {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    loadTimeline();
  }, [ticketId]);

  const loadTimeline = async () => {
    const { data } = await supabase
      .from('ticket_comments')
      .select('*, profiles(nome)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (data) setEvents(data);
  };

  if (events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  {index < events.length - 1 && (
                    <div className="h-full w-px bg-border my-1" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{event.profiles?.nome}</p>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {event.is_internal && (
                      <span className="text-xs text-warning-foreground bg-warning/20 px-2 py-0.5 rounded">
                        Interno
                      </span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{event.comentario}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
