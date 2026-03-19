import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DattoDevice {
  uid: string;
  id: string;
  hostname: string;
  online: boolean;
}

interface DattoAccountSummary {
  id: string | null;
  name: string | null;
}

const MAX_LOG_PREVIEW = 240;

function sanitizeBodyPreview(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_LOG_PREVIEW);
}

function buildHttpError(endpoint: string, status: number, body: string): Error {
  const preview = sanitizeBodyPreview(body);

  if (status === 401) {
    console.error(`[Datto][401 unauthorized] endpoint=${endpoint} body="${preview}"`);
    return new Error(`Datto unauthorized (401) em ${endpoint}.`);
  }

  if (status === 403) {
    console.error(`[Datto][403 forbidden] endpoint=${endpoint} body="${preview}"`);
    return new Error(`Datto forbidden (403) em ${endpoint}.`);
  }

  if (status === 404) {
    console.error(`[Datto][404 endpoint not found] endpoint=${endpoint} body="${preview}"`);
    return new Error(`Datto endpoint not found (404) em ${endpoint}.`);
  }

  console.error(`[Datto][http_error] endpoint=${endpoint} status=${status} body="${preview}"`);
  return new Error(`Datto HTTP ${status} em ${endpoint}.`);
}

async function fetchDattoJson(
  url: string,
  endpoint: string,
  init: RequestInit,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Datto][network error] endpoint=${endpoint} message="${message}"`);
    throw new Error(`Datto network error em ${endpoint}: ${message}`);
  }

  const body = await response.text();

  if (!response.ok) {
    throw buildHttpError(endpoint, response.status, body);
  }

  if (/<!DOCTYPE html>|<html/i.test(body)) {
    const preview = sanitizeBodyPreview(body);
    console.error(`[Datto][invalid_response_html] endpoint=${endpoint} body="${preview}"`);
    throw new Error(`Datto retornou HTML em ${endpoint}; esperado JSON.`);
  }

  try {
    return JSON.parse(body);
  } catch {
    const preview = sanitizeBodyPreview(body);
    console.error(`[Datto][invalid_json] endpoint=${endpoint} body="${preview}"`);
    throw new Error(`Datto retornou JSON inválido em ${endpoint}.`);
  }
}

function normalizeDattoDevice(raw: any): DattoDevice {
  const id = raw?.id ?? raw?.deviceId ?? raw?.device_id ?? "";
  const uid = raw?.uid ?? raw?.deviceUid ?? raw?.device_uid ?? "";
  const hostname = raw?.hostname ?? raw?.deviceName ?? raw?.name ?? "Dispositivo sem nome";
  const onlineValue = raw?.online ?? raw?.isOnline ?? raw?.status;

  const online =
    onlineValue === true ||
    String(onlineValue).toLowerCase() === "true" ||
    String(onlineValue).toLowerCase() === "online";

  return {
    uid: String(uid || id),
    id: String(id || uid),
    hostname: String(hostname),
    online,
  };
}

async function getDattoAccessToken(apiUrl: string, apiKey: string, apiSecret: string): Promise<string> {
  const endpoint = "/auth/oauth/token";
  const tokenUrl = `${apiUrl}${endpoint}`;
  const credentials = btoa(`${apiKey}:${apiSecret}`);

  const data = await fetchDattoJson(tokenUrl, endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  }) as Record<string, unknown>;

  const accessToken = data?.access_token;
  if (!accessToken || typeof accessToken !== "string") {
    console.error("[Datto][oauth_error] access_token ausente na resposta do OAuth2");
    throw new Error("Datto OAuth2 inválido: access_token não encontrado.");
  }

  return accessToken;
}

async function fetchDattoAccount(apiUrl: string, token: string): Promise<DattoAccountSummary> {
  const endpoint = "/api/v2/account";
  const accountUrl = `${apiUrl}${endpoint}`;

  const data = await fetchDattoJson(accountUrl, endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  }) as Record<string, unknown>;

  return {
    id: (data?.id ?? data?.uid ?? data?.accountUid ?? null) as string | null,
    name: (data?.name ?? data?.accountName ?? data?.displayName ?? null) as string | null,
  };
}

async function fetchAllDattoDevices(apiUrl: string, token: string): Promise<DattoDevice[]> {
  const endpoint = "/api/v2/device";
  const allDevices: DattoDevice[] = [];
  const perPage = 250;
  const maxPages = 20;

  for (let page = 1; page <= maxPages; page++) {
    const url = `${apiUrl}${endpoint}?page=${page}&perPage=${perPage}`;

    const data = await fetchDattoJson(url, endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const deviceList =
      (Array.isArray((data as any)?.devices) && (data as any).devices) ||
      (Array.isArray((data as any)?.items) && (data as any).items) ||
      (Array.isArray((data as any)?.results) && (data as any).results) ||
      (Array.isArray(data) ? data : []);

    if (!Array.isArray(deviceList) || deviceList.length === 0) {
      break;
    }

    allDevices.push(...deviceList.map(normalizeDattoDevice));

    if (deviceList.length < perPage) {
      break;
    }
  }

  return allDevices;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dattoApiUrl = Deno.env.get("DATTO_API_URL")!;
    const dattoApiKey = Deno.env.get("DATTO_API_KEY")!;
    const dattoApiSecret = Deno.env.get("DATTO_API_SECRET")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Debug: verificar se os secrets chegaram (mostra apenas 4 primeiros chars)
    console.log(`[Datto] Config: URL=${dattoApiUrl}, KEY=${dattoApiKey?.substring(0, 4)}..., SECRET=${dattoApiSecret ? "SET(" + dattoApiSecret.length + " chars)" : "EMPTY"}`);
    console.log("[Datto] Iniciando autenticação OAuth2...");
    const accessToken = await getDattoAccessToken(dattoApiUrl, dattoApiKey, dattoApiSecret);

    console.log("[Datto] OAuth2 OK. Consultando /api/v2/account...");
    const account = await fetchDattoAccount(dattoApiUrl, accessToken);

    console.log("[Datto] Conta carregada. Consultando /api/v2/device...");
    const dattoDevices = await fetchAllDattoDevices(dattoApiUrl, accessToken);
    console.log(`[Datto] ${dattoDevices.length} dispositivos carregados.`);

    const dattoStatusMap = new Map<string, boolean>();
    for (const device of dattoDevices) {
      if (device.uid) dattoStatusMap.set(device.uid, device.online);
      if (device.id) dattoStatusMap.set(device.id, device.online);
    }

    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("id, datto_device_uid, datto_device_id, datto_status")
      .or("datto_device_id.not.is.null,datto_device_uid.not.is.null");

    if (assetsError) throw assetsError;

    const now = new Date().toISOString();
    let onlineCount = 0;
    let offlineCount = 0;
    let unmatchedCount = 0;

    for (const asset of assets || []) {
      const keys = [asset.datto_device_uid, asset.datto_device_id]
        .filter(Boolean)
        .map((value) => String(value));

      if (keys.length === 0) {
        unmatchedCount++;
        continue;
      }

      let isOnline: boolean | undefined;
      for (const key of keys) {
        const status = dattoStatusMap.get(key);
        if (status !== undefined) {
          isOnline = status;
          break;
        }
      }

      if (isOnline === undefined) {
        unmatchedCount++;
        offlineCount++;

        const { error: updateError } = await supabase
          .from("assets")
          .update({ datto_status: "offline", datto_last_sync: now })
          .eq("id", asset.id);

        if (updateError) throw updateError;
        continue;
      }

      const newStatus = isOnline ? "online" : "offline";
      if (isOnline) onlineCount++;
      else offlineCount++;

      const { error: updateError } = await supabase
        .from("assets")
        .update({ datto_status: newStatus, datto_last_sync: now })
        .eq("id", asset.id);

      if (updateError) throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        account,
        sync: {
          dattoDevices: dattoDevices.length,
          localAssets: assets?.length || 0,
          onlineCount,
          offlineCount,
          unmatchedCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Datto] datto-check-offline error:", message);

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
