import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let synced = 0;

    // 1. Sync from companies with WhatsApp numbers
    const { data: companies } = await supabase
      .from("companies")
      .select("id, nome_fantasia, whatsapp, telefone")
      .eq("status", true);

    if (companies) {
      for (const company of companies) {
        const phone = (company.whatsapp || company.telefone || "").replace(/\D/g, "");
        if (!phone || phone.length < 10) continue;

        const { data: existing } = await supabase
          .from("waba_conversations")
          .select("id")
          .eq("phone_number", phone)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("waba_conversations").insert({
            phone_number: phone,
            contact_name: company.nome_fantasia,
            status: "active",
            queue_status: "resolved",
            ai_enabled: true,
          });
          synced++;
        }
      }
    }

    // 2. Sync from whatsapp_contacts table
    const { data: contacts } = await supabase
      .from("whatsapp_contacts")
      .select("phone_number, contact_name, company_id");

    if (contacts) {
      for (const contact of contacts) {
        const phone = (contact.phone_number || "").replace(/\D/g, "");
        if (!phone || phone.length < 10) continue;

        const { data: existing } = await supabase
          .from("waba_conversations")
          .select("id")
          .eq("phone_number", phone)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("waba_conversations").insert({
            phone_number: phone,
            contact_name: contact.contact_name || "Contato",
            status: "active",
            queue_status: "resolved",
            ai_enabled: true,
          });
          synced++;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, synced }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
