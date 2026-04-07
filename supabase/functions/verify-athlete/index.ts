import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type VerificationPayload = {
  qr_code: string;
  first_name?: string;
  last_name?: string;
  code?: string; // CID
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] verify-athlete: Request received`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`[${requestId}] verify-athlete: Missing environment variables`);
      return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Security check: API Key
    const expectedApiKey = Deno.env.get("IMPORT_API_KEY");
    if (expectedApiKey) {
      const requestApiKey = req.headers.get("x-api-key") || req.headers.get("X-Api-Key");
      if (requestApiKey !== expectedApiKey) {
        console.warn(`[${requestId}] verify-athlete: Unauthorized access attempt (invalid API key)`);
        return new Response(JSON.stringify({ error: "Unauthorized: Invalid API Key" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as VerificationPayload;
    if (!body.qr_code) {
      return new Response(JSON.stringify({ error: "Missing qr_code in payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Search for the athlete by QR code
    const { data: athlete, error } = await supabase
      .from("athletes")
      .select("id, code, first_name, last_name, category, class")
      .eq("qr_code", body.qr_code)
      .eq("is_deleted", false)
      .maybeSingle();

    if (error || !athlete) {
      console.log(`[${requestId}] verify-athlete: Athlete not found or error:`, error);
      return new Response(JSON.stringify({
        recognized: false,
        message: "Athlete not found with this QR code"
      }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // verify matching details if provided
    let matchesDetails = true;
    const mismatches = [];

    if (body.first_name && athlete.first_name.toLowerCase() !== body.first_name.toLowerCase()) {
      matchesDetails = false;
      mismatches.push("first_name");
    }
    if (body.last_name && athlete.last_name.toLowerCase() !== body.last_name.toLowerCase()) {
      matchesDetails = false;
      mismatches.push("last_name");
    }
    if (body.code && athlete.code !== body.code) {
      matchesDetails = false;
      mismatches.push("code (CID)");
    }

    console.log(`[${requestId}] verify-athlete: Success for athlete ${athlete.id}`);
    return new Response(JSON.stringify({
      recognized: true,
      matches_provided_details: matchesDetails,
      mismatches: mismatches.length > 0 ? mismatches : undefined,
      athlete: {
        id: athlete.id,
        code: athlete.code,
        first_name: athlete.first_name,
        last_name: athlete.last_name,
        category: athlete.category,
        class: athlete.class
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error(`[${requestId}] verify-athlete: Global error:`, error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
