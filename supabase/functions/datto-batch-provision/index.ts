import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Manual mapping of Datto site names to company IDs based on existing data
const SITE_TO_COMPANY: Record<string, string> = {
  'almoxaryfe': '5d9ac960-b13e-4bd8-a2bb-618de8ffb7f7',
  'andrea digital': '28710adc-0827-416d-afa5-ffd5fb11cb7e',
  'belocorp': 'e8643b8b-e298-41e8-94d4-fabe3494f503',
  'belomotors seguradora': '8e4288fd-5bcb-4c51-b33c-d7c5fa9fb928',
  'brasil linhas': 'd2320c6a-c13c-4c28-9b69-062bea0b8262',
  'centro oeste assistencia': 'f65ca603-a86d-4aa2-99f0-ff79994e3613',
  'centro oeste pecas': 'a4df4edf-3401-4dee-a0dc-2373a4eafbd5',
  'conexao virtual': '57b42e36-825d-4bf3-b2cc-5d0e11fb81b6',
  'dellicata paes': 'b1b097f5-7698-40f9-bfb5-6bbc1d53b481',
  'escritorio nova era': '3dbbb4ea-44d8-49ad-bdc9-e1951361601a',
  'estamparia fabrica lenismar': '28bcd7ac-2db7-465a-85d2-3030eb568e72',
  'eva fashion': '9e1f456f-4602-493f-bd99-9db8dc81b564',
  'everlest': '89ed7429-9d74-4496-9b27-aedc4c3618d9',
  'fgl luminosos': 'a577ecc1-daec-4cd4-bd76-c2238b2253c2',
  'hiper cristal': '7a88dd59-0de1-48f8-a27d-2f0486b1095c',
  'hit aviamentos': '7e419a79-459c-4d44-92e1-a1521f4c2d22',
  'mix aviamentos': '9394e13f-eac7-4807-adcb-bd556cdf8803',
  'reis malhas': 'acfd92f4-6ecb-447f-8b5b-f3c9a6d91ed1',
  'renata tecidos': 'ddaa70cb-8cbf-426e-8027-647a21509539',
  'roma distribuicao': 'f2c350c9-bb03-4769-bf75-f5d8766a84e2',
  'sv malhas': 'f33c665f-4fd9-42c3-a95d-57d81291af8a',
  'xz modas': '013d9515-b3a1-45f7-84f6-69cb244aebad',
  'top aviamentos': '38baf971-a515-45bf-b8ae-6b32d70f0f6a',
  'supermercado arroba': '1aecd9c8-dd78-4e58-82ae-e1990a5d2307',
  'supermercado cristal caravelas': '050c2038-c2c0-4aa2-acce-ddc1a372f624',
  'princezinha malhas': 'c7bf36b9-9b14-4942-8c43-93fea3185897',
  'center malhas': 'f5a116fa-6b52-4b0b-9292-38f9d1d1ebf1',
  'pao mana': 'ccf4c15b-676b-4fcd-8ff7-beaa001201b9',
  'pao mana': 'ccf4c15b-676b-4fcd-8ff7-beaa001201b9',
  'nova era aviamentos': 'a08acdd4-7014-464c-9287-6120268d4ef1',
  're estamparia': '28bcd7ac-2db7-465a-85d2-3030eb568e72',
  'renata rua 9': '27004bbf-e18d-4755-a89a-c971855d85e0',
};

function findCompanyId(siteName: string): string | null {
  const siteNorm = siteName.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '').trim();
  
  // Direct match
  if (SITE_TO_COMPANY[siteNorm]) return SITE_TO_COMPANY[siteNorm];
  
  // Partial match
  for (const [key, id] of Object.entries(SITE_TO_COMPANY)) {
    if (siteNorm.includes(key) || key.includes(siteNorm)) return id;
  }
  
  return null;
}

function inferAssetType(hostname: string): string {
  const h = hostname.toLowerCase();
  if (h.includes('srv') || h.includes('server') || h.startsWith('servidor')) return 'servidor';
  if (h.includes('nb') || h.includes('laptop') || h.includes('note') || h.includes('notebook')) return 'notebook';
  if (h.includes('sw') || h.includes('switch')) return 'switch';
  if (h.includes('rt') || h.includes('router')) return 'roteador';
  return 'desktop';
}

function buildConfigFromPayload(payload: any): Record<string, any> | null {
  const config: Record<string, any> = {};
  if (payload?.cpus) config.processador = payload.cpus;
  if (payload?.memory) config.memoria_ram = payload.memory;
  if (payload?.disks) config.armazenamento = payload.disks;
  if (payload?.intIpAddress) config.ip_interno = payload.intIpAddress;
  if (payload?.extIpAddress) config.ip_externo = payload.extIpAddress;
  if (payload?.domain) config.dominio = payload.domain;
  if (payload?.platform) config.plataforma = payload.platform;
  if (payload?.last_user) config.ultimo_usuario = payload.last_user;
  if (payload?.antivirus_product) config.antivirus = payload.antivirus_product;
  if (payload?.patchStatus) config.patch_status = payload.patchStatus;
  if (payload?.last_reboot) config.ultimo_reboot = payload.last_reboot;
  if (payload?.device_description) config.descricao_dispositivo = payload.device_description;
  return Object.keys(config).length > 0 ? config : null;
}

function buildObsFromPayload(payload: any, siteName: string): string {
  const parts = [`Ativo cadastrado automaticamente via batch Datto RMM.`];
  if (siteName) parts.push(`Site: ${siteName}.`);
  if (payload?.device_os) parts.push(`SO: ${payload.device_os}.`);
  if (payload?.platform) parts.push(`Plataforma: ${payload.platform}.`);
  if (payload?.last_user) parts.push(`Último usuário: ${payload.last_user}.`);
  if (payload?.intIpAddress) parts.push(`IP: ${payload.intIpAddress}.`);
  return parts.join(' ');
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all unique devices without asset_id, including raw_payload for hardware data
    const { data: unlinkedAlerts } = await supabase
      .from('datto_alerts_log')
      .select('device_id, device_hostname, site_name, raw_payload')
      .is('asset_id', null);

    if (!unlinkedAlerts || unlinkedAlerts.length === 0) {
      return new Response(JSON.stringify({ message: 'No unlinked alerts found', created: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deduplicate by device_id, keeping the most data-rich alert
    const uniqueDevices = new Map<string, { device_id: string; device_hostname: string; site_name: string; raw_payload: any }>();
    for (const alert of unlinkedAlerts) {
      if (alert.device_id && !uniqueDevices.has(alert.device_id)) {
        uniqueDevices.set(alert.device_id, alert);
      }
    }

    console.log(`Found ${uniqueDevices.size} unique devices without assets`);

    let created = 0;
    let linked = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const [deviceId, device] of uniqueDevices) {
      // Check if asset already exists by device_id
      const { data: existingByDeviceId } = await supabase
        .from('assets')
        .select('id')
        .eq('datto_device_id', deviceId)
        .maybeSingle();

      if (existingByDeviceId) {
        // Asset exists, link alerts + enrich missing fields
        const payload = device.raw_payload || {};
        const enrichUpdate: Record<string, any> = {
          datto_last_sync: new Date().toISOString(),
        };
        
        // Check and enrich missing fields
        const { data: currentAsset } = await supabase
          .from('assets')
          .select('sistema_operacional, numero_serie, configuracoes')
          .eq('id', existingByDeviceId.id)
          .single();

        if (currentAsset) {
          if (!currentAsset.sistema_operacional && payload.device_os) {
            enrichUpdate.sistema_operacional = payload.device_os;
          }
          if (!currentAsset.numero_serie && payload.device_serial_number) {
            enrichUpdate.numero_serie = payload.device_serial_number;
          }
          const newConfig = buildConfigFromPayload(payload);
          if (newConfig) {
            enrichUpdate.configuracoes = { ...(currentAsset.configuracoes || {}), ...newConfig };
          }
        }

        if (Object.keys(enrichUpdate).length > 1) {
          await supabase.from('assets').update(enrichUpdate).eq('id', existingByDeviceId.id);
        }

        await supabase
          .from('datto_alerts_log')
          .update({ asset_id: existingByDeviceId.id })
          .eq('device_id', deviceId)
          .is('asset_id', null);
        linked++;
        results.push({ device: device.device_hostname, action: 'linked_existing', asset_id: existingByDeviceId.id });
        continue;
      }

      // Check if asset exists by hostname
      const { data: existingByHostname } = await supabase
        .from('assets')
        .select('id')
        .ilike('nome', `%${device.device_hostname}%`)
        .maybeSingle();

      if (existingByHostname) {
        // Update asset with datto_device_id and link alerts
        await supabase
          .from('assets')
          .update({ datto_device_id: deviceId, datto_status: 'online', datto_last_sync: new Date().toISOString() })
          .eq('id', existingByHostname.id);
        await supabase
          .from('datto_alerts_log')
          .update({ asset_id: existingByHostname.id })
          .eq('device_id', deviceId)
          .is('asset_id', null);
        linked++;
        results.push({ device: device.device_hostname, action: 'linked_by_hostname', asset_id: existingByHostname.id });
        continue;
      }

      // Find company for this device
      let companyId = findCompanyId(device.site_name || '');
      
      // Auto-create company if no match found
      if (!companyId && device.site_name) {
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({
            nome_fantasia: device.site_name,
            tipo_contrato: 'eventual',
            status: true,
          })
          .select('id')
          .single();

        if (companyError) {
          console.error(`Error creating company for ${device.site_name}:`, companyError);
          skipped++;
          results.push({ device: device.device_hostname, site: device.site_name, action: 'error_creating_company', error: companyError.message });
          continue;
        }
        companyId = newCompany.id;
        results.push({ site: device.site_name, action: 'company_auto_created', company_id: companyId });
      }
      
      if (!companyId) {
        skipped++;
        results.push({ device: device.device_hostname, site: device.site_name, action: 'skipped_no_company' });
        continue;
      }

      // Create asset with enriched data
      const tipo = inferAssetType(device.device_hostname || '');
      const payload = device.raw_payload || {};
      const configuracoes = buildConfigFromPayload(payload);
      const { data: newAsset, error: assetError } = await supabase
        .from('assets')
        .insert({
          nome: device.device_hostname || `Device-${deviceId}`,
          company_id: companyId,
          tipo,
          estado: 'em_uso',
          datto_device_id: deviceId,
          datto_status: 'online',
          datto_last_sync: new Date().toISOString(),
          sistema_operacional: payload.device_os || null,
          numero_serie: payload.device_serial_number || null,
          configuracoes: configuracoes,
          observacoes: buildObsFromPayload(payload, device.site_name),
        })
        .select('id')
        .single();

      if (assetError) {
        console.error(`Error creating asset for ${device.device_hostname}:`, assetError);
        results.push({ device: device.device_hostname, action: 'error', error: assetError.message });
        continue;
      }

      // Link all alerts for this device
      await supabase
        .from('datto_alerts_log')
        .update({ asset_id: newAsset.id })
        .eq('device_id', deviceId)
        .is('asset_id', null);

      created++;
      results.push({ device: device.device_hostname, site: device.site_name, action: 'created', asset_id: newAsset.id, tipo });
    }

    console.log(`Batch provision complete: ${created} created, ${linked} linked, ${skipped} skipped`);

    return new Response(JSON.stringify({
      success: true,
      summary: { total_devices: uniqueDevices.size, created, linked, skipped },
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Batch provision error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
