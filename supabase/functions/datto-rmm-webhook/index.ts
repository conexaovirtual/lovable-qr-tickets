import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DattoPayload {
  alertlevel?: string;
  device_id?: string;
  device_uid?: string;
  device_hostname?: string;
  device_ip?: string;
  device_os?: string;
  device_description?: string;
  site_id?: string;
  site_uid?: string;
  site_name?: string;
  alert_uid?: string;
  alert_type?: string;
  alert_category?: string;
  alert_message?: string;
  alert_priority?: string;
  platform?: string;
  last_user?: string;
}

function mapPriority(dattoP: string | undefined): string {
  switch (dattoP?.toLowerCase()) {
    case 'critical': return 'critica';
    case 'high':
    case 'warning': return 'alta';
    case 'moderate':
    case 'medium': return 'media';
    default: return 'baixa';
  }
}

function mapImpact(dattoP: string | undefined): string {
  switch (dattoP?.toLowerCase()) {
    case 'critical': return 'alto';
    case 'high':
    case 'warning': return 'alto';
    case 'moderate':
    case 'medium': return 'medio';
    default: return 'baixo';
  }
}

function mapUrgency(dattoP: string | undefined): string {
  switch (dattoP?.toLowerCase()) {
    case 'critical': return 'alta';
    case 'high':
    case 'warning': return 'alta';
    case 'moderate':
    case 'medium': return 'media';
    default: return 'baixa';
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
    const authHeader = req.headers.get('authorization');
    const webhookSecret = Deno.env.get('DATTO_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.error('DATTO_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader?.replace('Bearer ', '');
    if (token !== webhookSecret) {
      console.warn('Invalid webhook token received');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: DattoPayload = await req.json();
    console.log('Datto webhook received:', {
      alert_uid: payload.alert_uid,
      device_hostname: payload.device_hostname,
      alert_type: payload.alert_type,
      alert_priority: payload.alert_priority,
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find matching asset by datto_device_id or hostname (nome)
    let asset = null;

    if (payload.device_id) {
      const { data } = await supabase
        .from('assets')
        .select('id, company_id, nome, estado')
        .eq('datto_device_id', payload.device_id)
        .maybeSingle();
      asset = data;
    }

    if (!asset && payload.device_hostname) {
      const { data } = await supabase
        .from('assets')
        .select('id, company_id, nome, estado')
        .ilike('nome', `%${payload.device_hostname}%`)
        .maybeSingle();
      asset = data;
    }

    // Update asset datto status
    if (asset) {
      const dattoStatus = payload.alertlevel === 'triggered' ? 'alert' : 'online';
      await supabase
        .from('assets')
        .update({
          datto_status: dattoStatus,
          datto_last_sync: new Date().toISOString(),
          datto_device_id: payload.device_id || undefined,
          datto_device_uid: payload.device_uid || undefined,
          datto_site_id: payload.site_id || undefined,
        })
        .eq('id', asset.id);
    }

    // Create ticket for critical/warning alerts
    let ticketId = null;
    const priority = payload.alert_priority?.toLowerCase();
    const shouldCreateTicket = priority === 'critical' || priority === 'high' || priority === 'warning';

    if (shouldCreateTicket && asset) {
      // Check for duplicate alert (same alert_uid in last hour)
      if (payload.alert_uid) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: existing } = await supabase
          .from('datto_alerts_log')
          .select('id')
          .eq('alert_uid', payload.alert_uid)
          .gte('created_at', oneHourAgo)
          .maybeSingle();

        if (existing) {
          console.log('Duplicate alert within 1 hour, skipping ticket creation');
        } else {
          // Enrich alert with AI
          let descricao = '';
          try {
            const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
            if (lovableApiKey) {
              const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${lovableApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-3-flash-preview",
                  messages: [
                    {
                      role: "system",
                      content: `Você é um especialista em TI. Recebeu um alerta de monitoramento Datto RMM. Traduza a mensagem técnica em uma descrição clara e útil em português brasileiro. Inclua:
1. O que o alerta significa
2. Possível impacto no usuário
3. 2-3 ações imediatas recomendadas
Seja conciso (máx 150 palavras). Responda apenas o texto.`
                    },
                    {
                      role: "user",
                      content: `Alerta: ${payload.alert_type || 'N/A'}
Categoria: ${payload.alert_category || 'N/A'}
Mensagem: ${payload.alert_message || 'N/A'}
Dispositivo: ${payload.device_hostname || 'N/A'} (${payload.device_os || 'N/A'})
Prioridade: ${payload.alert_priority || 'N/A'}`
                    }
                  ],
                  temperature: 0.3,
                }),
              });

              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                const aiText = aiData.choices?.[0]?.message?.content?.trim();
                if (aiText) {
                  descricao = [
                    `🔔 Alerta automático do Datto RMM`,
                    ``,
                    `**Dispositivo:** ${payload.device_hostname || 'N/A'}`,
                    `**IP:** ${payload.device_ip || 'N/A'}`,
                    `**SO:** ${payload.device_os || 'N/A'}`,
                    `**Site:** ${payload.site_name || 'N/A'}`,
                    `**Tipo de Alerta:** ${payload.alert_type || 'N/A'}`,
                    `**Categoria:** ${payload.alert_category || 'N/A'}`,
                    ``,
                    `**Mensagem Original:** ${payload.alert_message || 'Sem detalhes'}`,
                    ``,
                    `---`,
                    `🤖 **Análise da IA:**`,
                    aiText,
                    ``,
                    `_Último usuário logado: ${payload.last_user || 'N/A'}_`,
                  ].join('\n');
                }
              }
            }
          } catch (aiErr) {
            console.error('AI enrichment error (non-fatal):', aiErr);
          }

          // Fallback description without AI
          if (!descricao) {
            descricao = [
              `🔔 Alerta automático do Datto RMM`,
              ``,
              `**Dispositivo:** ${payload.device_hostname || 'N/A'}`,
              `**IP:** ${payload.device_ip || 'N/A'}`,
              `**SO:** ${payload.device_os || 'N/A'}`,
              `**Site:** ${payload.site_name || 'N/A'}`,
              `**Tipo de Alerta:** ${payload.alert_type || 'N/A'}`,
              `**Categoria:** ${payload.alert_category || 'N/A'}`,
              ``,
              `**Mensagem:** ${payload.alert_message || 'Sem detalhes'}`,
              ``,
              `_Último usuário logado: ${payload.last_user || 'N/A'}_`,
            ].join('\n');
          }

          const { data: ticket, error: ticketError } = await supabase
            .from('tickets')
            .insert({
              company_id: asset.company_id,
              titulo: `[DATTO] ${payload.alert_type || 'Alerta'}: ${payload.device_hostname || 'Dispositivo'}`,
              descricao,
              canal: 'monitoramento',
              status: 'novo',
              impacto: mapImpact(payload.alert_priority),
              urgencia: mapUrgency(payload.alert_priority),
              asset_id: asset.id,
            })
            .select('id, numero')
            .single();

          if (ticketError) {
            console.error('Error creating ticket:', ticketError);
          } else {
            ticketId = ticket.id;
            console.log(`Ticket #${ticket.numero} created for alert`);

            // Update asset to maintenance if critical
            if (priority === 'critical') {
              await supabase
                .from('assets')
                .update({ estado: 'manutencao' })
                .eq('id', asset.id);
            }

            // Send push notification to technicians
            try {
              await fetch(
                `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                  },
                  body: JSON.stringify({
                    role: 'tecnico',
                    title: `🔔 [DATTO] ${payload.alert_type || 'Alerta'}`,
                    body: `${payload.device_hostname}: ${payload.alert_message || 'Alerta de monitoramento'}`,
                    tag: `datto-${payload.alert_uid}`,
                    data: { ticketId: ticket.id, url: `/tickets/${ticket.id}` },
                  }),
                }
              );
            } catch (pushErr) {
              console.error('Push notification error (non-fatal):', pushErr);
            }
          }
        }
      }
    } else if (shouldCreateTicket && !asset) {
      // Asset not found - create ai_alert
      await supabase.from('ai_alerts').insert({
        tipo: 'datto_device_not_found',
        severidade: 'warning',
        titulo: `Dispositivo Datto não vinculado: ${payload.device_hostname || payload.device_id}`,
        descricao: `Um alerta foi recebido do Datto RMM para o dispositivo "${payload.device_hostname}" (ID: ${payload.device_id}), mas nenhum ativo correspondente foi encontrado no sistema. Vincule o device_id ao ativo correto.`,
        acao_sugerida: `Acesse a página de Ativos e vincule o Device ID "${payload.device_id}" ao ativo correspondente.`,
        dados: payload as any,
      });
    }

    // Log the alert
    await supabase.from('datto_alerts_log').insert({
      alert_uid: payload.alert_uid,
      device_id: payload.device_id,
      asset_id: asset?.id || null,
      ticket_id: ticketId,
      alert_type: payload.alert_type,
      alert_category: payload.alert_category,
      alert_message: payload.alert_message,
      alert_priority: payload.alert_priority,
      device_hostname: payload.device_hostname,
      device_ip: payload.device_ip,
      site_name: payload.site_name,
      raw_payload: payload as any,
      processed: true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        asset_found: !!asset,
        ticket_created: !!ticketId,
        ticket_id: ticketId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Datto webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
