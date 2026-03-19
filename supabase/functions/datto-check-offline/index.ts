import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function getDattoAccessToken(apiUrl: string, apiKey: string, apiSecret: string): Promise<string> {
  const tokenUrl = `${apiUrl}/auth/oauth/token`;
  const credentials = btoa(`${apiKey}:${apiSecret}`);

  console.log(`Requesting token from: ${tokenUrl}`);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const text = await res.text();
  console.log(`Token response status: ${res.status}, body preview: ${text.substring(0, 200)}`);

  if (!res.ok) {
    throw new Error(`Datto OAuth failed (${res.status}): ${text.substring(0, 300)}`);
  }

  const data = JSON.parse(text);
  return data.access_token;
}

interface DattoDevice {
  uid: string;
  id: number;
  hostname: string;
  online: boolean;
  lastSeen?: string;
}

async function fetchAllDattoDevices(apiUrl: string, token: string): Promise<DattoDevice[]> {
  const allDevices: DattoDevice[] = [];
  let page = 1;
  const perPage = 250;
  let hasMore = true;

  while (hasMore) {
    const url = `${apiUrl}/api/v2/account/devices?page=${page}&perPage=${perPage}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Datto API devices failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const devices = data.devices || data.items || data || [];

    if (Array.isArray(devices) && devices.length > 0) {
      allDevices.push(...devices);
      if (devices.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
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

    // 1. Authenticate with Datto RMM API
    console.log("Authenticating with Datto RMM API...");
    const accessToken = await getDattoAccessToken(dattoApiUrl, dattoApiKey, dattoApiSecret);

    // 2. Fetch all devices from Datto
    console.log("Fetching devices from Datto API...");
    const dattoDevices = await fetchAllDattoDevices(dattoApiUrl, accessToken);
    console.log(`Fetched ${dattoDevices.length} devices from Datto API`);

    // 3. Build a map of datto uid -> online status
    const dattoStatusMap = new Map<string, boolean>();
    for (const device of dattoDevices) {
      if (device.uid) {
        dattoStatusMap.set(device.uid, device.online === true);
      }
    }

    // 4. Fetch all monitored assets from our database
    const { data: assets, error } = await supabase
      .from("assets")
      .select("id, datto_device_uid, datto_device_id, datto_status")
      .not("datto_device_id", "is", null);

    if (error) throw error;

    const now = new Date().toISOString();
    let onlineCount = 0;
    let offlineCount = 0;
    let unmatchedCount = 0;

    // 5. Update each asset based on Datto API response
    for (const asset of assets || []) {
      const matchKey = asset.datto_device_uid || asset.datto_device_id;
      if (!matchKey) {
        unmatchedCount++;
        continue;
      }

      // Try matching by uid first, then by device_id string
      let isOnline: boolean | undefined = dattoStatusMap.get(matchKey);

      // If no match by uid, try matching by numeric id converted to string
      if (isOnline === undefined && asset.datto_device_id) {
        for (const device of dattoDevices) {
          if (String(device.id) === asset.datto_device_id || device.uid === asset.datto_device_id) {
            isOnline = device.online === true;
            break;
          }
        }
      }

      if (isOnline === undefined) {
        // Device not found in Datto API — mark as offline
        if (asset.datto_status !== "offline") {
          await supabase
            .from("assets")
            .update({ datto_status: "offline", datto_last_sync: now })
            .eq("id", asset.id);
        }
        offlineCount++;
        unmatchedCount++;
        continue;
      }

      const newStatus = isOnline ? "online" : "offline";

      if (asset.datto_status !== newStatus) {
        await supabase
          .from("assets")
          .update({ datto_status: newStatus, datto_last_sync: now })
          .eq("id", asset.id);
      } else {
        // Still update last_sync to show we checked
        await supabase
          .from("assets")
          .update({ datto_last_sync: now })
          .eq("id", asset.id);
      }

      if (isOnline) onlineCount++;
      else offlineCount++;
    }

    const summary = `datto-check-offline: ${dattoDevices.length} Datto devices, ${assets?.length || 0} local assets, ${onlineCount} online, ${offlineCount} offline, ${unmatchedCount} unmatched`;
    console.log(summary);

    return new Response(
      JSON.stringify({
        success: true,
        dattoDevices: dattoDevices.length,
        localAssets: assets?.length || 0,
        onlineCount,
        offlineCount,
        unmatchedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("datto-check-offline error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
