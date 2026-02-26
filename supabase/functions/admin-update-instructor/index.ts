import { serve } "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !anonKey || !serviceRoleKey) {
            return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const authHeader = req.headers.get("Authorization") ?? "";
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const {
            data: { user: requester },
            error: userError,
        } = await userClient.auth.getUser();

        if (userError || !requester) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        // Check if requester is admin
        const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
            _user_id: requester.id,
            _role: "admin",
        });

        if (roleError || !isAdmin) {
            return new Response(JSON.stringify({ error: "Forbidden: Admin role required" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { user_id, full_name } = await req.json();

        if (!user_id || !full_name) {
            return new Response(JSON.stringify({ error: "user_id and full_name are required" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        // Update profile with service role (bypasses RLS)
        const { error: profileError } = await adminClient
            .from("profiles")
            .update({ full_name })
            .eq("user_id", user_id);

        if (profileError) throw profileError;

        // Re-link athletes
        const { error: linkError } = await adminClient
            .from("athletes")
            .update({ instructor_id: user_id })
            .eq("instructor", full_name);

        if (linkError) throw linkError;

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (error: any) {
        console.error("admin-update-instructor error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Unknown error" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
