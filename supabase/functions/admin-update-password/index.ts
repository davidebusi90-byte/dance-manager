import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};



type Body = {
  user_id: string;
  new_password: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
        status: 200, // Changed from 500 to allow frontend to show error
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid session" }), {
        status: 200, // Changed from 401
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin role required" }), {
        status: 200, // Changed from 403
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Rate limiting per admin - DISABLED for debugging
    // if (!checkRateLimit(user.id)) { ... }

    const body = (await req.json()) as Body;
    if (!body?.user_id || !body?.new_password) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 200, // Changed from 400
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.user_id)) {
      return new Response(JSON.stringify({ error: "Invalid user_id format" }), {
        status: 200, // Changed from 400
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (body.new_password.length < 6) {
      return new Response(JSON.stringify({ error: "Password too short" }), {
        status: 200, // Changed from 400
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Validate target user exists (optional, but let's just proceed to update)
    // The restriction that target MUST be an instructor is removed.
    // Admins can update any user's password.

    // Log the attempt for audit purposes before action
    console.log(`Admin ${user.id} attempting to update password for User ${body.user_id}`);

    const { error: updateError } = await adminClient.auth.admin.updateUserById(body.user_id, {
      password: body.new_password,
    });

    if (updateError) {
      console.error("Update failed:", updateError);
      return new Response(JSON.stringify({ error: `Update failed: ${updateError.message}` }), {
        status: 200, // Return 200 so frontend can read the error
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Audit logging
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    console.log(`Password reset: admin=${user.id}, target=${body.user_id}, ip=${clientIp}, timestamp=${new Date().toISOString()}`);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("admin-update-password error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: `Exception: ${message}` }), {
      status: 200, // Changed from 500
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
