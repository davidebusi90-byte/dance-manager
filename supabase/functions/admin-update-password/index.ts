import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[admin-update-password] starting request processing...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("[admin-update-password] Missing environment variables");
      throw new Error("Missing backend configuration");
    }

    // Parse body early
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[admin-update-password] Failed to parse JSON body");
      throw new Error("Invalid JSON body");
    }

    const { user_id, new_password } = body;
    if (!user_id || !new_password) {
      throw new Error("Missing user_id or new_password");
    }

    if (new_password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // Auth verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[admin-update-password] Missing Authorization header");
      throw new Error("No authorization header provided");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requester }, error: userError } = await userClient.auth.getUser();
    if (userError || !requester) {
      console.error("[admin-update-password] Auth error:", userError?.message);
      throw new Error("Unauthorized: " + (userError?.message || "Invalid session"));
    }

    // Role verification (Admin only)
    console.log(`[admin-update-password] Verifying admin role for: ${requester.email}`);
    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: requester.id,
      _role: "admin",
    });

    if (roleError) {
      console.error("[admin-update-password] Role check RPC error:", roleError.message);
      throw new Error("Error verifying user roles");
    }

    if (!isAdmin) {
      console.warn(`[admin-update-password] Access denied for user: ${requester.email}`);
      throw new Error("Forbidden: Admin role required");
    }

    // Password Update using Service Role
    console.log(`[admin-update-password] Updating password for target user_id: ${user_id}`);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateError) {
      console.error("[admin-update-password] Admin update error:", updateError.message);
      throw updateError;
    }

    console.log("[admin-update-password] Password successfully updated");
    return new Response(JSON.stringify({ success: true, message: "Password updated" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("[admin-update-password] Caught error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
