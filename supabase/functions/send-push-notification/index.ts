import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  user_ids?: string[];
  role?: 'admin_provedor' | 'tecnico';
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  tag?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload: PushPayload = await req.json();
    console.log('Push notification request:', { 
      role: payload.role, 
      user_ids: payload.user_ids,
      title: payload.title 
    });

    let query = supabase.from('push_subscriptions').select('*');
    
    if (payload.user_ids && payload.user_ids.length > 0) {
      query = query.in('user_id', payload.user_ids);
    } else if (payload.role) {
      const { data: users } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', payload.role);
      
      const userIds = users?.map(u => u.user_id) || [];
      console.log(`Found ${userIds.length} users with role ${payload.role}`);
      
      if (userIds.length === 0) {
        console.log('No users found for role, skipping push');
        return new Response(JSON.stringify({ success: true, sent: 0, failed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      query = query.in('user_id', userIds);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }

    console.log(`Sending to ${subscriptions?.length || 0} subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions found');
      return new Response(JSON.stringify({ success: true, sent: 0, failed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidEmail = Deno.env.get('VAPID_EMAIL');

    if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
      throw new Error('VAPID keys not configured');
    }

    const webpush = await import('npm:web-push@3.6.7');
    
    webpush.setVapidDetails(
      `mailto:${vapidEmail}`,
      vapidPublicKey,
      vapidPrivateKey
    );

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          };

          const notificationPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/logo-conexaovirtual.png',
            badge: payload.badge || '/logo-conexaovirtual.png',
            data: payload.data || {},
            tag: payload.tag || 'default'
          });

          console.log(`Sending push to endpoint: ${sub.endpoint.substring(0, 50)}...`);
          return await webpush.sendNotification(pushSubscription, notificationPayload);
        } catch (error) {
          console.error('Error sending to subscription:', error);
          throw error;
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Push results: ${sent} sent, ${failed} failed`);

    return new Response(JSON.stringify({ 
      success: true, 
      sent, 
      failed 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);
