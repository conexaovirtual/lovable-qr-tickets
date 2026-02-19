import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  const subscribeToPush = async (): Promise<PushSubscription | null> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return null;
    }

    setIsLoading(true);

    try {
      // Aguardar service worker estar pronto
      const registration = await navigator.serviceWorker.ready;
      
      // Verificar se já existe uma subscription
      let existingSub = await (registration as any).pushManager.getSubscription();
      
      if (existingSub) {
        console.log('Already subscribed to push notifications');
        setSubscription(existingSub);
        setIsLoading(false);
        return existingSub;
      }

      // Criar nova subscription
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not configured');
      }

      const sub = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
      });

      console.log('Successfully subscribed to push notifications');

      // Salvar subscription no banco
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const p256dh = sub.getKey('p256dh');
        const auth = sub.getKey('auth');

        if (!p256dh || !auth) {
          throw new Error('Failed to get subscription keys');
        }

        const { error } = await supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
          auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
          user_agent: navigator.userAgent
        }, {
          onConflict: 'endpoint'
        });

        if (error) {
          console.error('Error saving subscription:', error);
          throw error;
        }

        console.log('Subscription saved to database');
      }

      setSubscription(sub);
      setIsLoading(false);
      return sub;
    } catch (error) {
      console.error('Push subscription error:', error);
      setIsLoading(false);
      return null;
    }
  };

  const unsubscribeFromPush = async (): Promise<boolean> => {
    if (!subscription) {
      return false;
    }

    try {
      await subscription.unsubscribe();
      
      // Remover do banco
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setSubscription(null);
      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      return false;
    }
  };

  return {
    permission,
    subscription,
    isLoading,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush
  };
};
