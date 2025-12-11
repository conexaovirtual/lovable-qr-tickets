import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ServiceOrderWithRelations {
  id: string;
  numero_os: number;
  data_agendada: string;
  hora_agendada: string | null;
  tecnico_id: string | null;
  notified_at: string | null;
  companies: { nome_fantasia: string } | null;
  assets: { nome: string; tipo: string } | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];
    
    console.log(`Checking service orders for date: ${today}`);
    
    const { data: serviceOrders, error } = await supabase
      .from('service_orders')
      .select(`
        id,
        numero_os,
        data_agendada,
        hora_agendada,
        tecnico_id,
        notified_at,
        companies:company_id (nome_fantasia),
        assets:asset_id (nome, tipo)
      `)
      .eq('data_agendada', today)
      .in('status', ['agendada', 'em_andamento'])
      .is('notified_at', null);

    if (error) {
      console.error('Error fetching service orders:', error);
      throw error;
    }

    console.log(`Found ${serviceOrders?.length || 0} service orders for today`);

    if (!serviceOrders || serviceOrders.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        message: 'No service orders to notify'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    for (const os of serviceOrders as unknown as ServiceOrderWithRelations[]) {
      const recipients: string[] = [];
      
      // Buscar admins
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin_provedor');
      
      if (admins) {
        recipients.push(...admins.map(a => a.user_id));
      }
      
      // Adicionar técnico responsável
      if (os.tecnico_id) {
        recipients.push(os.tecnico_id);
      }

      console.log(`Sending notification for OS #${os.numero_os} to ${recipients.length} recipients`);

      // Enviar push notification
      try {
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
          },
          body: JSON.stringify({
            user_ids: recipients,
            title: `⏰ OS #${os.numero_os} agendada hoje`,
            body: `${os.hora_agendada || 'Sem hora'} - ${os.companies?.nome_fantasia || 'Cliente'} - ${os.assets?.nome || 'Ativo'}`,
            data: {
              type: 'service_order_reminder',
              serviceOrderId: os.id,
              numeroOS: os.numero_os
            },
            tag: `os-${os.id}`
          })
        });

        if (!response.ok) {
          console.error(`Failed to send push for OS #${os.numero_os}`);
        } else {
          console.log(`Push sent successfully for OS #${os.numero_os}`);
        }
      } catch (pushError) {
        console.error(`Error sending push for OS #${os.numero_os}:`, pushError);
      }

      // Marcar como notificada
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', os.id);

      if (updateError) {
        console.error(`Error updating notification status for OS #${os.numero_os}:`, updateError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: serviceOrders.length 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in check-service-orders-reminder:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
