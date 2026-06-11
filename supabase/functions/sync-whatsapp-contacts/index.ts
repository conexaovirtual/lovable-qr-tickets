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

    const MABBIX_BACKEND_URL = Deno.env.get("MABBIX_BACKEND_URL")?.replace("//chat.mabbix.com.br", "//apichat.mabbix.com.br");
    const MABBIX_CONNECTION_TOKEN = Deno.env.get("MABBIX_CONNECTION_TOKEN");

    let synced = 0;
    let photosUpdated = 0;

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

    // 3. Fetch profile photos via Mabbix API (Whaticket-based)
    if (MABBIX_BACKEND_URL && MABBIX_CONNECTION_TOKEN) {
      const { data: convosWithoutPhoto } = await supabase
        .from("waba_conversations")
        .select("id, phone_number")
        .is("profile_photo_url", null)
        .limit(30);

      if (convosWithoutPhoto && convosWithoutPhoto.length > 0) {
        const endpoint = `${MABBIX_BACKEND_URL}/api/contacts/getProfilePicUrl`;
        console.log(`Fetching photos for ${convosWithoutPhoto.length} contacts via Mabbix: ${endpoint}`);

        for (const convo of convosWithoutPhoto) {
          try {
            const resp = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${MABBIX_CONNECTION_TOKEN}`,
              },
              body: JSON.stringify({ number: convo.phone_number }),
            });

            if (resp.ok) {
              const data = await resp.json();
              const photoUrl = data?.profilePicUrl || data?.profilePictureUrl || data?.picture || data?.url || null;
              if (photoUrl) {
                await supabase
                  .from("waba_conversations")
                  .update({ profile_photo_url: photoUrl })
                  .eq("id", convo.id);
                photosUpdated++;
              }
            } else {
              console.log(`Photo not available (${resp.status}) for ${convo.phone_number}`);
            }

            await new Promise((r) => setTimeout(r, 300));
          } catch (err) {
            console.log(`Photo fetch error for ${convo.phone_number}:`, err);
          }
        }
        console.log(`Photos updated: ${photosUpdated}`);
      }
    } else {
      console.log("Mabbix API não configurada (URL/TOKEN), pulando sync de fotos");
    }

    return new Response(
      JSON.stringify({ ok: true, synced, photosUpdated }),
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
