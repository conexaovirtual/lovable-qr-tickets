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
// ─── Auto-link or create asset + company via AI ─────────────────────
async function autoLinkOrCreateAsset(supabase: any, payload: DattoPayload) {
  try {
    const siteName = payload.site_name || '';
    const hostname = payload.device_hostname || payload.device_id || 'Desconhecido';

    // Fetch all companies for AI matching
    const { data: companies } = await supabase
      .from('companies')
      .select('id, nome_fantasia, razao_social, cnpj')
      .eq('status', true);

    let companyId: string | null = null;
    let companyName = siteName || hostname;
    let autoCreated = false;

    if (companies && companies.length > 0 && siteName) {
      // Use AI to find best match
      const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
      if (lovableApiKey) {
        const companyList = companies.map((c: any) =>
          `ID: ${c.id} | Nome: ${c.nome_fantasia} | Razão: ${c.razao_social || 'N/A'}`
        ).join('\n');

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `Você é um sistema de matching de empresas. Dado o nome de um site/cliente do Datto RMM, encontre a empresa correspondente na lista. 
Considere abreviações, variações e nomes parciais. Exemplo: "ACME Corp" pode ser "ACME Corporação Ltda".
Responda APENAS com o ID da empresa encontrada, ou "NONE" se nenhuma for compatível. Não adicione explicações.`
              },
              {
                role: "user",
                content: `Site Datto: "${siteName}"\nHostname: "${hostname}"\n\nEmpresas cadastradas:\n${companyList}`
              }
            ],
            temperature: 0.1,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiResult = aiData.choices?.[0]?.message?.content?.trim();
          
          if (aiResult && aiResult !== 'NONE') {
            const match = companies.find((c: any) => c.id === aiResult);
            if (match) {
              companyId = match.id;
              companyName = match.nome_fantasia;
              console.log(`AI matched site "${siteName}" to company "${companyName}" (${companyId})`);
            }
          }
        }
      }

      // Fallback: text match
      if (!companyId) {
        const siteNorm = siteName.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const c of companies) {
          const nameNorm = c.nome_fantasia.toLowerCase().replace(/[^a-z0-9]/g, '');
          const razaoNorm = (c.razao_social || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (siteNorm.includes(nameNorm) || nameNorm.includes(siteNorm) ||
              siteNorm.includes(razaoNorm) || razaoNorm.includes(siteNorm)) {
            companyId = c.id;
            companyName = c.nome_fantasia;
            console.log(`Fallback matched site "${siteName}" to company "${companyName}"`);
            break;
          }
        }
      }
    }

    // Auto-create company if no match
    if (!companyId) {
      const newCompanyName = siteName || `Datto - ${hostname}`;
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          nome_fantasia: newCompanyName,
          tipo_contrato: 'eventual',
          status: true,
        })
        .select('id')
        .single();

      if (companyError) {
        console.error('Error auto-creating company:', companyError);
        return null;
      }

      companyId = newCompany.id;
      autoCreated = true;
      console.log(`Auto-created company "${newCompanyName}" (${companyId})`);

      await supabase.from('ai_alerts').insert({
        tipo: 'datto_auto_company_created',
        severidade: 'info',
        titulo: `Empresa criada automaticamente: ${newCompanyName}`,
        descricao: `A IA criou automaticamente a empresa "${newCompanyName}" a partir do site Datto "${siteName}". Verifique os dados e complete o cadastro (CNPJ, endereço, contrato, etc).`,
        acao_sugerida: `Acesse Empresas e complete o cadastro de "${newCompanyName}".`,
        dados: { site_name: siteName, device_hostname: hostname, auto_created: true } as any,
      });
    }

    // Determine asset type from hostname/OS
    let tipo = 'desktop';
    const osLower = (payload.device_os || '').toLowerCase();
    const hostLower = hostname.toLowerCase();
    if (hostLower.includes('srv') || hostLower.includes('server') || osLower.includes('server')) {
      tipo = 'servidor';
    } else if (hostLower.includes('nb') || hostLower.includes('laptop') || hostLower.includes('note')) {
      tipo = 'notebook';
    } else if (hostLower.includes('sw') || hostLower.includes('switch')) {
      tipo = 'switch';
    } else if (hostLower.includes('rt') || hostLower.includes('router')) {
      tipo = 'roteador';
    }

    // Create asset
    const { data: newAsset, error: assetError } = await supabase
      .from('assets')
      .insert({
        nome: hostname,
        company_id: companyId,
        tipo,
        estado: 'em_uso',
        datto_device_id: payload.device_id || null,
        datto_device_uid: payload.device_uid || null,
        datto_site_id: payload.site_id || null,
        datto_status: 'online',
        datto_last_sync: new Date().toISOString(),
        sistema_operacional: payload.device_os || null,
        observacoes: `Ativo criado automaticamente via Datto RMM. Site: ${siteName}. ${autoCreated ? '(Empresa também criada automaticamente)' : ''}`,
      })
      .select('id, company_id, nome, estado')
      .single();

    if (assetError) {
      console.error('Error auto-creating asset:', assetError);
      return null;
    }

    console.log(`Auto-created asset "${hostname}" linked to company ${companyId}`);

    await supabase.from('ai_alerts').insert({
      tipo: 'datto_auto_asset_created',
      severidade: 'info',
      titulo: `Ativo criado automaticamente: ${hostname}`,
      descricao: `O ativo "${hostname}" foi criado e vinculado à empresa "${companyName}". Verifique as informações e complete o cadastro.`,
      acao_sugerida: `Acesse Ativos e complete o cadastro de "${hostname}" (fabricante, modelo, nº série, etc).`,
      dados: { device_hostname: hostname, device_id: payload.device_id, site_name: siteName, company_id: companyId, company_auto_created: autoCreated } as any,
    });

    return newAsset;
  } catch (err) {
    console.error('autoLinkOrCreateAsset error:', err);
    return null;
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

    // ─── Find or auto-create asset + company ───────────────────────────
    let asset = null;

    // 1. Try by datto_device_id
    if (payload.device_id) {
      const { data } = await supabase
        .from('assets')
        .select('id, company_id, nome, estado')
        .eq('datto_device_id', payload.device_id)
        .maybeSingle();
      asset = data;
    }

    // 2. Try by hostname
    if (!asset && payload.device_hostname) {
      const { data } = await supabase
        .from('assets')
        .select('id, company_id, nome, estado')
        .ilike('nome', `%${payload.device_hostname}%`)
        .maybeSingle();
      asset = data;
    }

    // 3. If no asset found, use AI to match/create company + asset
    if (!asset && (payload.device_hostname || payload.device_id)) {
      console.log('Asset not found, attempting AI auto-link...');
      asset = await autoLinkOrCreateAsset(supabase, payload);
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

          const TECNICO_ID = 'e336e78e-c11a-48b5-8d69-2bb48cf6bb3b';
          const TECNICO_PHONE = '5562999522470';

          const { data: ticket, error: ticketError } = await supabase
            .from('tickets')
            .insert({
              company_id: asset.company_id,
              titulo: `[DATTO] ${payload.alert_type || 'Alerta'}: ${payload.device_hostname || 'Dispositivo'}`,
              descricao,
              canal: 'monitoramento',
              status: 'em_atendimento',
              impacto: mapImpact(payload.alert_priority),
              urgencia: mapUrgency(payload.alert_priority),
              asset_id: asset.id,
              tecnico_id: TECNICO_ID,
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

            // Send WhatsApp notification to technician
            try {
              const MABBIX_BACKEND_URL = Deno.env.get('MABBIX_BACKEND_URL');
              const MABBIX_CONNECTION_TOKEN = Deno.env.get('MABBIX_CONNECTION_TOKEN');
              if (MABBIX_BACKEND_URL && MABBIX_CONNECTION_TOKEN) {
                const whatsappMsg = [
                  `🔔 *Alerta Datto RMM - Chamado #${ticket.numero}*`,
                  ``,
                  `📌 *Dispositivo:* ${payload.device_hostname || 'N/A'}`,
                  `🏢 *Site:* ${payload.site_name || 'N/A'}`,
                  `⚠️ *Tipo:* ${payload.alert_type || 'N/A'}`,
                  `🔴 *Prioridade:* ${payload.alert_priority || 'N/A'}`,
                  ``,
                  `💬 *Mensagem:* ${payload.alert_message || 'Sem detalhes'}`,
                  ``,
                  `O chamado já foi aberto e atribuído a você. Acesse o sistema para mais detalhes.`,
                ].join('\n');

                await fetch(`${MABBIX_BACKEND_URL}/sendText`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MABBIX_CONNECTION_TOKEN}`,
                  },
                  body: JSON.stringify({
                    number: TECNICO_PHONE,
                    text: whatsappMsg,
                  }),
                });
                console.log(`WhatsApp notification sent to technician for ticket #${ticket.numero}`);
              }
            } catch (waErr) {
              console.error('WhatsApp notification error (non-fatal):', waErr);
            }
          }
        }
      }
    } else if (shouldCreateTicket && !asset) {
      // Asset auto-creation failed - log warning
      console.warn('Could not auto-create asset for device:', payload.device_hostname);
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
