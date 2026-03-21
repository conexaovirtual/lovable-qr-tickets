import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ──

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function inferAssetType(hostname: string): string {
  const h = hostname.toLowerCase();
  if (/srv|server|serv|dc\d|ad\d|hyperv|cluster/i.test(h)) return "servidor";
  if (/nb|note|lap|laptop/i.test(h)) return "notebook";
  if (/cam|dvr|nvr|cftv/i.test(h)) return "camera";
  if (/print|imp|mfp/i.test(h)) return "impressora";
  if (/sw|switch/i.test(h)) return "switch";
  if (/ap|wifi|roteador|router|mikrotik/i.test(h)) return "roteador";
  return "desktop";
}

// ── Token management (reused from datto-check-offline) ──

interface StoredToken {
  id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

async function getStoredToken(supabase: any): Promise<StoredToken | null> {
  const { data, error } = await supabase
    .from("datto_oauth_tokens")
    .select("id, access_token, refresh_token, expires_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return data as StoredToken;
}

function isTokenExpired(token: StoredToken): boolean {
  if (!token.expires_at) return false;
  return new Date(token.expires_at).getTime() - 5 * 60 * 1000 < Date.now();
}

async function refreshAccessToken(supabase: any, storedToken: StoredToken, dattoApiUrl: string): Promise<string> {
  if (!storedToken.refresh_token) throw new Error("Token expirado e sem refresh_token. Reautorize o Datto.");
  const tokenUrl = `${dattoApiUrl}/auth/oauth/token`;
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa("public-client:public")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: storedToken.refresh_token }).toString(),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Falha ao renovar token Datto (${response.status}). Reautorize.`);
  const tokenData = JSON.parse(body);
  const newAccessToken = tokenData.access_token as string;
  if (!newAccessToken) throw new Error("access_token não encontrado na renovação.");
  const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null;
  await supabase.from("datto_oauth_tokens").update({
    access_token: newAccessToken,
    refresh_token: tokenData.refresh_token || storedToken.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq("id", storedToken.id);
  return newAccessToken;
}

async function getDattoAccessToken(supabase: any, dattoApiUrl: string): Promise<string> {
  const storedToken = await getStoredToken(supabase);
  if (!storedToken) throw new Error("Nenhum token Datto encontrado. Autorize o Datto RMM primeiro.");
  if (isTokenExpired(storedToken)) return await refreshAccessToken(supabase, storedToken, dattoApiUrl);
  return storedToken.access_token;
}

// ── Datto API calls ──

async function fetchDattoJson(url: string, token: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Datto HTTP ${response.status}: ${body.substring(0, 200)}`);
  return JSON.parse(body);
}

async function fetchAllDevices(apiUrl: string, token: string): Promise<any[]> {
  const endpointCandidates = ["/api/v2/account/devices", "/api/v2/device", "/api/v2/devices"];
  const perPage = 250;
  const maxPages = 20;

  for (const endpoint of endpointCandidates) {
    const allDevices: any[] = [];
    try {
      for (let page = 0; page < maxPages; page++) {
        const query = endpoint === "/api/v2/account/devices"
          ? `max=${perPage}&page=${page}`
          : `page=${page + 1}&perPage=${perPage}`;
        const data = await fetchDattoJson(`${apiUrl}${endpoint}?${query}`, token) as any;
        const list =
          (Array.isArray(data?.devices) && data.devices) ||
          (Array.isArray(data?.items) && data.items) ||
          (Array.isArray(data?.results) && data.results) ||
          (Array.isArray(data) ? data : []);
        if (!Array.isArray(list) || list.length === 0) break;
        allDevices.push(...list);
        if (list.length < perPage) break;
      }
      if (allDevices.length > 0) {
        console.log(`[FullSync] Endpoint OK: ${endpoint}, ${allDevices.length} devices`);
        return allDevices;
      }
    } catch (err: any) {
      if (err.message?.includes("HTTP 404")) continue;
      throw err;
    }
  }
  return [];
}

async function fetchDeviceDetails(apiUrl: string, token: string, uid: string): Promise<any> {
  try {
    return await fetchDattoJson(`${apiUrl}/api/v2/device/${uid}`, token);
  } catch {
    return null;
  }
}

// Batch fetch with concurrency limit
async function fetchDetailsBatch(apiUrl: string, token: string, uids: string[], concurrency = 5): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  for (let i = 0; i < uids.length; i += concurrency) {
    const batch = uids.slice(i, i + concurrency);
    const details = await Promise.all(batch.map(uid => fetchDeviceDetails(apiUrl, token, uid)));
    batch.forEach((uid, idx) => {
      if (details[idx]) results.set(uid, details[idx]);
    });
  }
  return results;
}

// ── Build configuracoes JSON ──

// Helper to dig into nested audit objects
function dig(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    const val = obj?.[k];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  // Also search inside common nested containers
  for (const container of ["deviceAudit", "systemInfo", "hardwareInfo", "audit"]) {
    if (obj?.[container] && typeof obj[container] === "object") {
      for (const k of keys) {
        const val = obj[container][k];
        if (val !== undefined && val !== null && val !== "") return val;
      }
    }
  }
  return null;
}

function buildConfiguracoes(detail: any): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  // Processador — muitas variações possíveis na API Datto
  const proc = dig(detail, "processor", "cpuName", "cpu", "processorName", "cpuModel", "processorModel");
  if (proc) {
    if (typeof proc === "object") {
      // Some Datto versions return processor as an object
      config.processador = proc.name ?? proc.model ?? proc.description ?? JSON.stringify(proc);
      if (proc.cores) config.processador_cores = Number(proc.cores);
      if (proc.threads) config.processador_threads = Number(proc.threads);
      if (proc.speed || proc.clockSpeed) config.processador_ghz = String(proc.speed ?? proc.clockSpeed);
    } else {
      config.processador = String(proc);
    }
  }

  // Memória RAM — em bytes ou já em GB
  const memBytes = dig(detail, "memory", "totalMemory", "memoryTotal", "ram", "physicalMemory", "totalPhysicalMemory");
  if (memBytes && Number(memBytes) > 0) {
    const num = Number(memBytes);
    // Se > 1024 provavelmente está em bytes; se < 1024 já está em GB
    config.memoria_ram_gb = num > 1024 ? Math.round(num / (1024 * 1024 * 1024)) : Math.round(num);
  }

  // Discos
  const disks = dig(detail, "disks", "drives", "diskDrives", "volumes", "storageDevices");
  if (Array.isArray(disks) && disks.length > 0) {
    config.armazenamento = disks.map((d: any) => {
      const sizeRaw = d.size ?? d.totalSize ?? d.capacity ?? d.sizeBytes;
      const freeRaw = d.free ?? d.freeSpace ?? d.freeBytes ?? d.availableSpace;
      const sizeNum = sizeRaw ? Number(sizeRaw) : null;
      const freeNum = freeRaw ? Number(freeRaw) : null;
      return {
        disco: d.name ?? d.letter ?? d.mountPoint ?? d.deviceName ?? "?",
        total_gb: sizeNum ? (sizeNum > 1024 * 1024 ? Math.round(sizeNum / (1024 * 1024 * 1024)) : Math.round(sizeNum)) : null,
        livre_gb: freeNum ? (freeNum > 1024 * 1024 ? Math.round(freeNum / (1024 * 1024 * 1024)) : Math.round(freeNum)) : null,
      };
    });
  }

  // IPs
  const intIp = dig(detail, "intIpAddress", "internalIp", "localIp", "privateIp", "lanIp");
  if (intIp) config.ip_interno = String(intIp);

  const extIp = dig(detail, "extIpAddress", "externalIp", "publicIp", "wanIp");
  if (extIp) config.ip_externo = String(extIp);

  // Domínio
  const domain = dig(detail, "domain", "domainName", "adDomain");
  if (domain) config.dominio = String(domain);

  // Último usuário
  const lastUser = dig(detail, "lastLoggedInUser", "lastUser", "loggedInUser", "currentUser");
  if (lastUser) config.ultimo_usuario = String(lastUser);

  // MAC Address
  const mac = dig(detail, "macAddress", "macAddr", "primaryMac");
  if (mac) config.mac_address = String(mac);

  return config;
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dattoApiUrl = Deno.env.get("DATTO_API_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get token
    console.log("[FullSync] Obtendo access token...");
    const accessToken = await getDattoAccessToken(supabase, dattoApiUrl);

    // 2. Fetch all devices
    console.log("[FullSync] Buscando todos os dispositivos...");
    const devices = await fetchAllDevices(dattoApiUrl, accessToken);
    console.log(`[FullSync] ${devices.length} dispositivos encontrados.`);

    if (devices.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum dispositivo encontrado no Datto.", report: { total: 0 } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch hardware details for all devices
    const uids = devices.map((d: any) => String(d.uid ?? d.deviceUid ?? d.device_uid ?? d.id ?? "")).filter(Boolean);
    console.log(`[FullSync] Buscando detalhes de hardware para ${uids.length} dispositivos...`);
    const detailsMap = await fetchDetailsBatch(dattoApiUrl, accessToken, uids, 5);
    console.log(`[FullSync] Detalhes obtidos para ${detailsMap.size} dispositivos.`);

    // Diagnostic: log first device detail to discover field names
    if (detailsMap.size > 0) {
      const firstEntry = detailsMap.values().next().value;
      console.log("[FullSync] DIAGNOSTIC - First device detail keys:", JSON.stringify(Object.keys(firstEntry || {})));
      for (const container of ["deviceAudit", "systemInfo", "hardwareInfo", "audit"]) {
        if (firstEntry?.[container]) {
          console.log(`[FullSync] DIAGNOSTIC - ${container} keys:`, JSON.stringify(Object.keys(firstEntry[container])));
        }
      }
      const hwFields = ["processor", "cpuName", "cpu", "memory", "totalMemory", "memoryTotal", "disks", "drives", "diskDrives"];
      const found: Record<string, any> = {};
      for (const f of hwFields) {
        if (firstEntry?.[f] !== undefined) found[f] = typeof firstEntry[f] === "object" ? JSON.stringify(firstEntry[f]).substring(0, 200) : firstEntry[f];
      }
      console.log("[FullSync] DIAGNOSTIC - Hardware fields found:", JSON.stringify(found));
    }


    const { data: existingAssets } = await supabase
      .from("assets")
      .select("id, datto_device_uid, datto_device_id, company_id")
      .or("datto_device_id.not.is.null,datto_device_uid.not.is.null");

    const assetByUid = new Map<string, any>();
    const assetById = new Map<string, any>();
    for (const a of existingAssets || []) {
      if (a.datto_device_uid) assetByUid.set(String(a.datto_device_uid), a);
      if (a.datto_device_id) assetById.set(String(a.datto_device_id), a);
    }

    const { data: companies } = await supabase.from("companies").select("id, nome_fantasia");
    const companyList = companies || [];

    function findCompanyId(siteName: string): string | null {
      if (!siteName) return null;
      for (const c of companyList) {
        if (fuzzyMatch(siteName, c.nome_fantasia)) return c.id;
      }
      return null;
    }

    // 5. Process each device
    const now = new Date().toISOString();
    let updated = 0;
    let created = 0;
    let noCompany = 0;
    const unmatchedSites: string[] = [];

    for (const device of devices) {
      const uid = String(device.uid ?? device.deviceUid ?? device.device_uid ?? "");
      const deviceId = String(device.id ?? device.deviceId ?? device.device_id ?? "");
      const hostname = String(device.hostname ?? device.deviceName ?? device.name ?? "Sem nome");
      const siteName = String(device.siteName ?? device.site_name ?? device.siteDescription ?? "");
      const isOnline = device.online === true || String(device.online).toLowerCase() === "true" || String(device.status).toLowerCase() === "online";

      const detail = detailsMap.get(uid) || detailsMap.get(deviceId);
      const configuracoes = detail ? buildConfiguracoes(detail) : {};
      const os = detail?.operatingSystem ?? detail?.os ?? detail?.osName ?? null;
      const serial = detail?.serialNumber ?? detail?.serial ?? null;
      const dattoStatus = isOnline ? "online" : "offline";

      // Check if asset exists
      const existingAsset = assetByUid.get(uid) || assetById.get(deviceId);

      if (existingAsset) {
        // Update existing
        const updateData: Record<string, unknown> = {
          datto_status: dattoStatus,
          datto_last_sync: now,
          updated_at: now,
        };
        if (Object.keys(configuracoes).length > 0) updateData.configuracoes = configuracoes;
        if (os) updateData.sistema_operacional = String(os);
        if (serial) updateData.numero_serie = String(serial);

        await supabase.from("assets").update(updateData).eq("id", existingAsset.id);
        updated++;
      } else {
        // Create new — need company_id
        const companyId = findCompanyId(siteName);
        if (!companyId) {
          noCompany++;
          const normSite = normalize(siteName);
          if (normSite && !unmatchedSites.includes(normSite)) unmatchedSites.push(normSite);
          continue;
        }

        const tipo = inferAssetType(hostname);
        await supabase.from("assets").insert({
          nome: hostname,
          tipo,
          company_id: companyId,
          datto_device_uid: uid || null,
          datto_device_id: deviceId || null,
          datto_status: dattoStatus,
          datto_last_sync: now,
          configuracoes: Object.keys(configuracoes).length > 0 ? configuracoes : null,
          sistema_operacional: os ? String(os) : null,
          numero_serie: serial ? String(serial) : null,
          estado: "em_uso",
        });
        created++;
      }
    }

    const report = {
      total: devices.length,
      detailsFetched: detailsMap.size,
      updated,
      created,
      noCompany,
      unmatchedSites: unmatchedSites.slice(0, 20),
    };

    console.log("[FullSync] Relatório:", JSON.stringify(report));

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[FullSync] Erro:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
