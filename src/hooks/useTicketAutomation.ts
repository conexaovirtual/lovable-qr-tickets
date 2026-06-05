import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

/**
 * Subscribes to realtime ticket events and surfaces toasts for the logged-in user.
 * - INSERT: notifies about new tickets.
 * - UPDATE: notifies about status changes.
 * Skips events triggered by the current user to avoid duplicate toasts.
 */
export function useTicketAutomation() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile || !user) return;

    const channel = supabase
      .channel('ticket-automation')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tickets' },
        (payload) => {
          const t: any = payload.new;
          if (!t?.id) return;
          const key = `i:${t.id}`;
          if (seen.current.has(key)) return;
          seen.current.add(key);
          if (t.solicitante_id === user.id) return;
          toast({
            title: `Novo ticket #${t.numero ?? ''}`.trim(),
            description: t.titulo ?? 'Um novo ticket foi criado.',
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets' },
        (payload) => {
          const newT: any = payload.new;
          const oldT: any = payload.old;
          if (!newT?.id || newT.status === oldT?.status) return;
          const key = `u:${newT.id}:${newT.status}`;
          if (seen.current.has(key)) return;
          seen.current.add(key);
          toast({
            title: `Ticket #${newT.numero ?? ''}`.trim(),
            description: `Status: ${newT.status}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, user, toast]);
}
