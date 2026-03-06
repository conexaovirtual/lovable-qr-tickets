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

    const MABBIX_BACKEND_URL = Deno.env.get("MABBIX_BACKEND_URL");
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

    // 3. Fetch profile photos via Mabbix API
    if (MABBIX_BACKEND_URL && MABBIX_CONNECTION_TOKEN) {
      const { data: convosWithoutPhoto } = await supabase
        .from("waba_conversations")
        .select("id, phone_number")
        .is("profile_photo_url", null)
        .limit(30);

      if (convosWithoutPhoto && convosWithoutPhoto.length > 0) {
        console.log(`Attempting photo sync for ${convosWithoutPhoto.length} contacts`);
        console.log(`MABBIX_BACKEND_URL: ${MABBIX_BACKEND_URL}`);

        // Try with first contact to discover the correct endpoint
        const testPhone = convosWithoutPhoto[0].phone_number;
        
        // Try multiple possible endpoint patterns
        const endpoints = [
          { url: `${MABBIX_BACKEND_URL}/chat/fetchProfilePictureUrl`, authHeader: "apikey" },
          { url: `${MABBIX_BACKEND_URL}/api/chat/fetchProfilePictureUrl`, authHeader: "Authorization" },
          { url: `${MABBIX_BACKEND_URL}/api/contacts/profilePicture`, authHeader: "Authorization" },
          { url: `${MABBIX_BACKEND_URL}/chat/fetchProfilePictureUrl`, authHeader: "Authorization" },
        ];

        let workingEndpoint: { url: string; authHeader: string } | null = null;

        for (const ep of endpoints) {
          try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (ep.authHeader === "apikey") {
              headers["apikey"] = MABBIX_CONNECTION_TOKEN;
            } else {
              headers["Authorization"] = `Bearer ${MABBIX_CONNECTION_TOKEN}`;
            }

            console.log(`Testing endpoint: ${ep.url} with ${ep.authHeader} header`);
            const testResp = await fetch(ep.url, {
              method: "POST",
              headers,
              body: JSON.stringify({ number: testPhone }),
            });

            const respText = await testResp.text();
            console.log(`Response ${testResp.status}: ${respText.substring(0, 200)}`);

            if (testResp.ok) {
              workingEndpoint = ep;
              // Parse and save the first result
              try {
                const data = JSON.parse(respText);
                const photoUrl = data?.profilePictureUrl || data?.profilePicUrl || data?.picture || data?.url || null;
                if (photoUrl) {
                  await supabase
                    .from("waba_conversations")
                    .update({ profile_photo_url: photoUrl })
                    .eq("id", convosWithoutPhoto[0].id);
                  photosUpdated++;
                }
              } catch (_) { /* parse error */ }
              break;
            }
          } catch (err) {
            console.log(`Endpoint ${ep.url} error:`, err);
          }
        }

        // If we found a working endpoint, process the rest
        if (workingEndpoint) {
          console.log(`Working endpoint found: ${workingEndpoint.url}`);
          for (let i = 1; i < convosWithoutPhoto.length; i++) {
            const convo = convosWithoutPhoto[i];
            try {
              const headers: Record<string, string> = { "Content-Type": "application/json" };
              if (workingEndpoint.authHeader === "apikey") {
                headers["apikey"] = MABBIX_CONNECTION_TOKEN;
              } else {
                headers["Authorization"] = `Bearer ${MABBIX_CONNECTION_TOKEN}`;
              }

              const resp = await fetch(workingEndpoint.url, {
                method: "POST",
                headers,
                body: JSON.stringify({ number: convo.phone_number }),
              });

              if (resp.ok) {
                const data = await resp.json();
                const photoUrl = data?.profilePictureUrl || data?.profilePicUrl || data?.picture || data?.url || null;
                if (photoUrl) {
                  await supabase
                    .from("waba_conversations")
                    .update({ profile_photo_url: photoUrl })
                    .eq("id", convo.id);
                  photosUpdated++;
                }
              } else {
                await resp.text(); // consume body
              }

              await new Promise((r) => setTimeout(r, 300));
            } catch (err) {
              console.log(`Photo error for ${convo.phone_number}:`, err);
            }
          }
        } else {
          console.log("No working endpoint found for profile photos. Tried:", endpoints.map(e => e.url));
        }
      }
    } else {
      console.log("Mabbix API not configured, skipping photo sync");
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
