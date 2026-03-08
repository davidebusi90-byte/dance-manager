import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

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

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !serviceRoleKey) {
            return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const expectedApiKey = Deno.env.get("IMPORT_API_KEY");
        if (expectedApiKey) {
            const requestApiKey = req.headers.get("x-api-key") || req.headers.get("X-Api-Key");
            if (requestApiKey !== expectedApiKey) {
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

        const { qr_code, first_name, last_name, code } = (await req.json()) as VerificationPayload;

        if (!qr_code) {
            return new Response(JSON.stringify({ error: "Missing qr_code in payload" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Search for the athlete by QR code
        const { data: athlete, error } = await supabase
            .from("athletes")
            .select("*")
            .eq("qr_code", qr_code)
            .eq("is_deleted", false)
            .single();

        if (error || !athlete) {
            return new Response(JSON.stringify({
                recognized: false,
                message: "Athlete not found with this QR code"
            }), {
                status: 404,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        // Optional: verify matching details if provided
        let matchesDetails = true;
        const mismatches = [];

        if (first_name && athlete.first_name.toLowerCase() !== first_name.toLowerCase()) {
            matchesDetails = false;
            mismatches.push("first_name");
        }
        if (last_name && athlete.last_name.toLowerCase() !== last_name.toLowerCase()) {
            matchesDetails = false;
            mismatches.push("last_name");
        }
        if (code && athlete.code !== code) {
            matchesDetails = false;
            mismatches.push("code (CID)");
        }

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

    } catch (error: unknown) {
        return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }
});
