import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
    user_id: string;
    new_email: string;
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

        // Check if the requester is logged in
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

        const body = (await req.json()) as Body;
        if (!body?.user_id || !body?.new_email) {
            return new Response(JSON.stringify({ error: "Missing required fields (user_id, new_email)" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.new_email)) {
            return new Response(JSON.stringify({ error: "Invalid email format" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Update user email
        const { error: updateError } = await adminClient.auth.admin.updateUserById(body.user_id, {
            email: body.new_email,
            email_confirm: true,
            user_metadata: { email: body.new_email } // Sometimes helpful to sync metadata
        });

        if (updateError) throw updateError;

        // Also update profile email if it exists there
        const { error: profileError } = await adminClient
            .from("profiles")
            .update({ email: body.new_email })
            .eq("user_id", body.user_id);

        if (profileError) {
            console.warn("Could not update profile email:", profileError);
            // Not critical enough to fail the request if Auth update succeeded
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });

    } catch (error: any) {
        console.error("admin-update-email error:", error);
        return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }
});
