import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInMinutes } from 'date-fns';

const NOTIFIED_KEY = 'agenda_notified_ids';
const CHECK_INTERVAL_MS = 60_000; // verifica a cada 1 minuto

function getNotifiedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveNotifiedId(id: string) {
  const ids = getNotifiedIds();
  ids.add(id);
  // Limita a 500 entradas para não encher o storage
  const arr = Array.from(ids).slice(-500);
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(arr));
}

async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showNotification(title: string, body: string, appointmentId: string) {
  if (Notification.permission !== 'granted') return;
  const notif = new Notification(title, {
    body,
    icon: '/logo-conexaovirtual.png',
    badge: '/logo-conexaovirtual.png',
    tag: `appointment-${appointmentId}`,
    requireInteraction: true,
  });
  notif.onclick = () => {
    window.focus();
    notif.close();
  };
}

export function useAppointmentNotifications(userId: string | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkUpcoming = useCallback(async () => {
    if (!userId) return;
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();

    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, title, appointment_date, appointment_time, notify_minutes')
      .eq('user_id', userId)
      .eq('status', 'agendado')
      .eq('appointment_date', today)
      .not('appointment_time', 'is', null);

    if (!appointments) return;

    const notified = getNotifiedIds();

    for (const appt of appointments) {
      if (notified.has(appt.id)) continue;
      if (!appt.appointment_time) continue;

      const [h, m] = appt.appointment_time.split(':').map(Number);
      const apptDate = new Date();
      apptDate.setHours(h, m, 0, 0);

      const minutesUntil = differenceInMinutes(apptDate, now);
      const notifyAt = appt.notify_minutes ?? 15;

      if (minutesUntil >= 0 && minutesUntil <= notifyAt) {
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const body = minutesUntil <= 1
          ? `Agora — ${timeStr}`
          : `Em ${minutesUntil} minuto${minutesUntil !== 1 ? 's' : ''} — ${timeStr}`;
        showNotification(`📅 ${appt.title}`, body, appt.id);
        saveNotifiedId(appt.id);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    checkUpcoming();
    intervalRef.current = setInterval(checkUpcoming, CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, checkUpcoming]);

  return { requestNotificationPermission };
}
