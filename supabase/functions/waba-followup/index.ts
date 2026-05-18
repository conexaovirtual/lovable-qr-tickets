import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("waba-followup skipped: outbound proactive customer messages are disabled by policy");

  return new Response(JSON.stringify({
    ok: true,
    followups_sent: 0,
    resolutions_sent: 0,
    errors: 0,
    skipped: true,
    reason: "proactive_customer_messages_disabled",
  }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});