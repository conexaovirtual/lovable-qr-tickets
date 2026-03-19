import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user via getClaims
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("[Datto OAuth Callback] getClaims error:", claimsError?.message);
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { code, redirect_uri } = body;

    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: "code e redirect_uri são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dattoApiUrl = Deno.env.get("DATTO_API_URL")!;
    const tokenUrl = `${dattoApiUrl}/auth/oauth/token`;

    console.log("[Datto OAuth Callback] Exchanging code for token...");

    // Exchange authorization code for access token
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri,
        client_id: "public-client",
        client_secret: "public",
      }).toString(),
    });

    const tokenBody = await tokenResponse.text();

    if (!tokenResponse.ok) {
      console.error(`[Datto OAuth Callback] Token exchange failed: ${tokenResponse.status} ${tokenBody.substring(0, 240)}`);
      return new Response(
        JSON.stringify({ error: `Falha ao trocar código: HTTP ${tokenResponse.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let tokenData: Record<string, unknown>;
    try {
      tokenData = JSON.parse(tokenBody);
    } catch {
      console.error("[Datto OAuth Callback] Invalid JSON response:", tokenBody.substring(0, 240));
      return new Response(
        JSON.stringify({ error: "Resposta inválida do Datto ao trocar código" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as string | undefined;
    const expiresIn = tokenData.expires_in as number | undefined;

    if (!accessToken) {
      console.error("[Datto OAuth Callback] No access_token in response:", JSON.stringify(tokenData));
      return new Response(
        JSON.stringify({ error: "access_token não encontrado na resposta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Calculate expiration time
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // Use service role to manage tokens table
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Delete old tokens and insert the new one
    await supabase.from("datto_oauth_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { error: insertError } = await supabase.from("datto_oauth_tokens").insert({
      access_token: accessToken,
      refresh_token: refreshToken || null,
      token_type: (tokenData.token_type as string) || "Bearer",
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("[Datto OAuth Callback] Error saving token:", insertError.message);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[Datto OAuth Callback] Token saved successfully. Expires at:", expiresAt);

    return new Response(
      JSON.stringify({
        success: true,
        expires_at: expiresAt,
        has_refresh_token: !!refreshToken,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Datto OAuth Callback] error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
