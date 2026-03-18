import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all monitored assets
    const { data: assets, error } = await supabase
      .from("assets")
      .select("id, datto_status, datto_last_sync")
      .not("datto_device_id", "is", null);

    if (error) throw error;

    const now = new Date();
    const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
    const ALERT_THRESHOLD_MS = 10 * 60 * 1000;   // 10 minutes

    let offlineCount = 0;
    let alertCount = 0;

    for (const asset of assets || []) {
      if (!asset.datto_last_sync) {
        // No sync ever recorded — mark offline
        if (asset.datto_status !== "offline") {
          await supabase
            .from("assets")
            .update({ datto_status: "offline" })
            .eq("id", asset.id);
          offlineCount++;
        }
        continue;
      }

      const lastSync = new Date(asset.datto_last_sync);
      const elapsed = now.getTime() - lastSync.getTime();

      if (elapsed > OFFLINE_THRESHOLD_MS && asset.datto_status !== "offline") {
        await supabase
          .from("assets")
          .update({ datto_status: "offline" })
          .eq("id", asset.id);
        offlineCount++;
      } else if (
        elapsed > ALERT_THRESHOLD_MS &&
        elapsed <= OFFLINE_THRESHOLD_MS &&
        asset.datto_status !== "alert"
      ) {
        await supabase
          .from("assets")
          .update({ datto_status: "alert" })
          .eq("id", asset.id);
        alertCount++;
      }
    }

    console.log(
      `datto-check-offline: ${assets?.length || 0} assets checked, ${offlineCount} marked offline, ${alertCount} marked alert`
    );

    return new Response(
      JSON.stringify({
        success: true,
        checked: assets?.length || 0,
        offlineCount,
        alertCount,
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
