import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

// --- Token management ---

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
  // Refresh 5 minutes before expiration
  return new Date(token.expires_at).getTime() - 5 * 60 * 1000 < Date.now();
}

async function refreshAccessToken(
  supabase: any,
  storedToken: StoredToken,
  dattoApiUrl: string,
): Promise<string> {
  if (!storedToken.refresh_token) {
    throw new Error("Token expirado e sem refresh_token. Reautorize o Datto.");
  }

  console.log("[Datto] Refreshing access token...");
  const tokenUrl = `${dattoApiUrl}/auth/oauth/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: storedToken.refresh_token,
      client_id: "public-client",
      client_secret: "public",
    }).toString(),
  });

  const body = await response.text();

  if (!response.ok) {
    console.error(`[Datto] Refresh failed: ${response.status} ${body.substring(0, 240)}`);
    throw new Error(`Falha ao renovar token Datto (${response.status}). Reautorize.`);
  }

  let tokenData: Record<string, unknown>;
  try {
    tokenData = JSON.parse(body);
  } catch {
    throw new Error("Resposta inválida ao renovar token Datto.");
  }

  const newAccessToken = tokenData.access_token as string;
  const newRefreshToken = tokenData.refresh_token as string | undefined;
  const expiresIn = tokenData.expires_in as number | undefined;

  if (!newAccessToken) {
    throw new Error("access_token não encontrado na renovação.");
  }

  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  // Update stored token
  await supabase
    .from("datto_oauth_tokens")
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken || storedToken.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storedToken.id);

  console.log("[Datto] Token refreshed successfully. Expires at:", expiresAt);
  return newAccessToken;
}

async function getDattoAccessToken(supabase: any, dattoApiUrl: string): Promise<string> {
  const storedToken = await getStoredToken(supabase);

  if (!storedToken) {
    throw new Error("Nenhum token Datto encontrado. Autorize o Datto RMM primeiro.");
  }

  if (isTokenExpired(storedToken)) {
    return await refreshAccessToken(supabase, storedToken, dattoApiUrl);
  }

  return storedToken.access_token;
}

// --- API calls ---

async function fetchDattoAccount(apiUrl: string, token: string): Promise<DattoAccountSummary> {
  const endpoint = "/api/v2/account";
  const data = await fetchDattoJson(`${apiUrl}${endpoint}`, endpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
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
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    const deviceList =
      (Array.isArray((data as any)?.devices) && (data as any).devices) ||
      (Array.isArray((data as any)?.items) && (data as any).items) ||
      (Array.isArray((data as any)?.results) && (data as any).results) ||
      (Array.isArray(data) ? data : []);

    if (!Array.isArray(deviceList) || deviceList.length === 0) break;
    allDevices.push(...deviceList.map(normalizeDattoDevice));
    if (deviceList.length < perPage) break;
  }

  return allDevices;
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dattoApiUrl = Deno.env.get("DATTO_API_URL")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("[Datto] Obtendo access token do banco de dados...");
    const accessToken = await getDattoAccessToken(supabase, dattoApiUrl);

    console.log("[Datto] Token OK. Consultando /api/v2/account...");
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
        await supabase
          .from("assets")
          .update({ datto_status: "offline", datto_last_sync: now })
          .eq("id", asset.id);
        continue;
      }

      const newStatus = isOnline ? "online" : "offline";
      if (isOnline) onlineCount++;
      else offlineCount++;

      await supabase
        .from("assets")
        .update({ datto_status: newStatus, datto_last_sync: now })
        .eq("id", asset.id);
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
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
