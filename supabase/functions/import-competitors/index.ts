import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Expected payload structure
type AthleteData = {
    code: string;
    first_name: string;
    last_name: string;
    birth_date?: string; // YYYY-MM-DD
    gender?: string;
    email?: string;
    phone?: string;
    category: string;
    class: string;
    medical_certificate_expiry?: string; // YYYY-MM-DD
    notes?: string;
    responsabili?: string[];
    partner_first_name?: string;
    partner_last_name?: string;
    disciplines?: string[];
};

type Body = {
    athletes: AthleteData[];
};

serve(async (req) => {
    // Handle CORS preflight
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

        // Basic authentication using a custom API key passed in headers
        // The external software should send "x-api-key" with the value configured in SUPABASE Deno Env
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

        // Only allow POST requests
        if (req.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
                status: 405,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const body = (await req.json()) as Body;

        if (!body || !body.athletes || !Array.isArray(body.athletes)) {
            return new Response(JSON.stringify({ error: "Invalid payload format. Expected { athletes: [...] }" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const results = {
            successful: 0,
            failed: 0,
            errors: [] as any[],
        };

        // Process each athlete (upserting based on unique code)
        for (const athlete of body.athletes) {
            if (!athlete.code || !athlete.first_name || !athlete.last_name || !athlete.category || !athlete.class) {
                results.failed++;
                results.errors.push({ code: athlete.code, error: "Missing required fields (code, first_name, last_name, category, class)" });
                continue;
            }

            const { error } = await adminClient
                .from("athletes")
                .upsert({
                    code: athlete.code,
                    first_name: athlete.first_name,
                    last_name: athlete.last_name,
                    birth_date: athlete.birth_date || null,
                    gender: athlete.gender || null,
                    email: athlete.email || null,
                    phone: athlete.phone || null,
                    category: athlete.category,
                    class: athlete.class,
                    medical_certificate_expiry: athlete.medical_certificate_expiry || null,
                    responsabili: athlete.responsabili && athlete.responsabili.length > 0 ? athlete.responsabili : null,
                    notes: athlete.notes || null,
                }, { onConflict: "code" });

            if (error) {
                results.failed++;
                results.errors.push({ code: athlete.code, error: error.message });
            } else {
                results.successful++;
            }
        }

        return new Response(JSON.stringify({
            message: "Import process completed.",
            results
        }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });

    } catch (error: unknown) {
        console.error("import-competitors error:", error);
        return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) || "Unknown error" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }
});
